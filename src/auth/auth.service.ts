// src/auth/auth.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { OtpService } from '../otp/otp.service';
import { OtpType } from '../otp/entities/otp.entity';
import { Device } from '../devices/entities/device.entity';
import {
  ChangePinDto,
  CompleteDeviceRegistrationDto,
  CompleteDeviceRegistrationByLinkDto,
  SetPinDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SignupDto,
  VerifyOtpDto,
  VerifyPinDto,
} from './dto';
import { EmailService } from '../email/email.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User, WalletStatus } from './entities/user.entity';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { WalletService as BlockchainWalletService } from '../blockchain/services/wallet.service';
import { BlockchainWalletStatus } from '../blockchain/entities/blockchain-wallet.entity';
import {
  WaitlistEntry,
  WaitlistStatus,
} from '../waitlist/entities/waitlist-entry.entity';
import {
  ReferralEvent,
  REFERRAL_POINTS,
} from '../waitlist/entities/referral-event.entity';
import { ReferralService } from '../referral/referral.service';
import { isInsecureDeviceSignatureBypassEnabled } from '../common/utils/device-signature.util';
import { generateShortCode } from '../common/utils/random-code.util';
import { countryFromPhone } from '../common/utils/phone-country.util';
import {
  normalizeEmail,
  normalizeIdentifier,
  normalizeUsername,
} from './utils/identity-normalization.util';

const BCRYPT_ROUNDS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// Wallet retry job payload
// ─────────────────────────────────────────────────────────────────────────────

export interface WalletCreationJobData {
  userId: string;
  username: string;
  /** Which chains still need wallets created */
  chains: Array<'stellar' | 'evm'>;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly rtRepo: Repository<RefreshToken>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(WaitlistEntry)
    private readonly waitlistRepo: Repository<WaitlistEntry>,
    @InjectRepository(ReferralEvent)
    private readonly referralEventRepo: Repository<ReferralEvent>,

    @Optional()
    @InjectQueue('wallet-creation')
    private readonly walletQueue: Queue | null,

    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly otpService: OtpService,
    private readonly blockchainService: BlockchainService,
    @Optional()
    private readonly blockchainWalletService: BlockchainWalletService | null,
    private readonly emailService: EmailService,

    @Optional()
    private readonly referralService: ReferralService | null,
  ) {}

  // ── Signup ─────────────────────────────────────────────────────────────────

  async signup(dto: SignupDto): Promise<{ userId: string; email: string }> {
    const normalizedDto = this.normalizeSignupDto(dto);
    const existingUser = await this.userRepo.findOne({
      where: { email: normalizedDto.email, emailVerified: true },
    });
    if (existingUser) throw new ConflictException('Email already registered');

    const waitlistEntry = await this.waitlistRepo.findOne({
      where: { email: normalizedDto.email },
    });

    if (waitlistEntry) {
      if (
        normalizeUsername(waitlistEntry.username) !== normalizedDto.username
      ) {
        throw new ConflictException(
          'Username does not match waitlist reservation',
        );
      }
      if (waitlistEntry.status === WaitlistStatus.CONVERTED) {
        // If the user was deleted from the DB, allow re-signup by resetting the waitlist entry
        const userExists = await this.userRepo.findOne({
          where: { email: normalizedDto.email },
        });
        if (userExists)
          throw new ConflictException('This email has already been converted');
        await this.waitlistRepo.update(
          { id: waitlistEntry.id },
          { status: WaitlistStatus.PENDING },
        );
        waitlistEntry.status = WaitlistStatus.PENDING;
      }
      return this.createUserFromWaitlist(normalizedDto, waitlistEntry);
    }

    // Allow open signup when SIGNUP_OPEN=true (set in Railway env vars)
    if (process.env.SIGNUP_OPEN === 'true') {
      return this.createUserFromWaitlist(normalizedDto, null);
    }

    throw new ForbiddenException(
      'Signup is currently restricted to waitlist users only',
    );
  }

  // ── Create user from waitlist ──────────────────────────────────────────────

  private async createUserFromWaitlist(
    dto: SignupDto,
    waitlistEntry: WaitlistEntry | null,
  ): Promise<{ userId: string; email: string }> {
    // ── Resume unverified signup (retry-safe) ─────────────────────────────
    const existingUnverified = await this.userRepo.findOne({
      where: { email: dto.email, emailVerified: false },
    });
    if (existingUnverified) {
      const phoneExists = await this.userRepo.findOne({
        where: { phone: dto.phone },
      });
      if (phoneExists && phoneExists.id !== existingUnverified.id) {
        throw new ConflictException('Phone already registered');
      }

      const usernameExists = await this.userRepo.findOne({
        where: { username: dto.username },
      });
      if (usernameExists && usernameExists.id !== existingUnverified.id) {
        throw new ConflictException('Username taken');
      }

      existingUnverified.fullName = dto.fullName;
      existingUnverified.phone = dto.phone;
      existingUnverified.username = dto.username;
      existingUnverified.country = countryFromPhone(dto.phone);
      existingUnverified.passwordHash = await bcrypt.hash(
        dto.password,
        BCRYPT_ROUNDS,
      );
      await this.userRepo.save(existingUnverified);

      await this.otpService.sendOtp(dto.email, OtpType.EMAIL_VERIFY, {
        fullName: dto.fullName,
      });

      await this.registerOrUpdateDeviceForUser(
        existingUnverified.id,
        dto.deviceId,
        dto.devicePublicKey,
      );
      return { userId: existingUnverified.id, email: existingUnverified.email };
    }

    // Conflict checks
    const phoneExists = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });
    if (phoneExists) throw new ConflictException('Phone already registered');

    const usernameExists = await this.userRepo.findOne({
      where: { username: dto.username },
    });
    if (usernameExists) throw new ConflictException('Username taken');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = this.userRepo.create({
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      username: dto.username,
      country: countryFromPhone(dto.phone),
      passwordHash,
      referralCode: generateShortCode(8),
      referredBy: waitlistEntry?.referrerId || null,
      points: waitlistEntry?.points ?? 0,
    });

    // ── Wallet creation (both chains) ─────────────────────────────────────
    // Each chain is attempted independently. If either fails the user is still
    // created and a BullMQ retry job is queued for the failed chain(s).
    const failedChains: Array<'stellar' | 'evm'> = [];

    // Stellar
    try {
      // createStellarWallet() funds the account AND establishes the USDC
      // trustline internally — do NOT call ensureTrustline separately.
      const stellarWallet = await this.blockchainService.createStellarWallet();
      user.stellarPublicKey = stellarWallet.publicKey;
      user.stellarSecretEnc = stellarWallet.secretKeyEnc;
      user.stellarWalletStatus = WalletStatus.ACTIVE;
      this.logger.log(
        `Stellar wallet created [user=${dto.username}] [pk=${stellarWallet.publicKey}]`,
      );
    } catch (err) {
      this.logger.error(
        `Stellar wallet creation failed [user=${dto.username}]: ${(err as Error).message}`,
      );
      failedChains.push('stellar');
      // user.stellarPublicKey / stellarSecretEnc remain null — retried by job
    }

    // Persist before EVM provisioning so the UUID used as the CREATE2 salt exists.
    await this.userRepo.save(user);

    // EVM — create one contract wallet per supported deposit chain.
    if (this.blockchainService.isEvmReady) {
      try {
        const evmResult = await this.createEvmWalletsForUser(
          user.id,
          dto.username,
        );

        user.evmAddress = evmResult.walletAddress;
        user.evmWalletStatus = evmResult.allActive
          ? WalletStatus.ACTIVE
          : WalletStatus.PENDING;
        this.logger.log(
          `EVM wallet created [user=${dto.username}]` +
            ` [contractWallet=${evmResult.walletAddress ?? 'pending'}]`,
        );
      } catch (err) {
        this.logger.error(
          `EVM wallet creation failed [user=${dto.username}]: ${(err as Error).message}`,
        );
        failedChains.push('evm');
        // user.evmAddress remains null — retried by job
      }
    }

    await this.userRepo.save(user);

    // ── Link app referral (Phase 7) ───────────────────────────────────────
    if (dto.referralCode && this.referralService) {
      await this.referralService
        .linkReferral(user.id, dto.referralCode)
        .catch((e: Error) =>
          this.logger.warn(`linkReferral failed [ref=${dto.referralCode}]: ${e.message}`),
        );
    }

    // Queue retry job if any chain failed — exponential backoff, 5 attempts
    if (failedChains.length > 0 && this.walletQueue) {
      await this.walletQueue.add(
        'retry-wallet-creation',
        {
          userId: user.id,
          username: user.username,
          chains: failedChains,
        } satisfies WalletCreationJobData,
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 10_000 }, // 10s, 20s, 40s, 80s, 160s
          removeOnComplete: true,
          removeOnFail: false, // keep failed jobs visible for inspection
        },
      );
      this.logger.warn(
        `Wallet creation queued for retry [user=${user.id}] [chains=${failedChains.join(',')}]`,
      );
    } else if (failedChains.length > 0) {
      const failUpdate: Partial<User> = {};
      if (failedChains.includes('stellar')) failUpdate.stellarWalletStatus = WalletStatus.FAILED;
      if (failedChains.includes('evm'))     failUpdate.evmWalletStatus     = WalletStatus.FAILED;
      await this.userRepo.update({ id: user.id }, failUpdate);
      this.logger.warn(
        `Wallet creation failed for [user=${user.id}] [chains=${failedChains.join(',')}] — Redis unavailable, no retry queued`,
      );
    }

    // ── Referral points ───────────────────────────────────────────────────
    if (waitlistEntry?.referrerId) {
      await this.awardReferralPoints(waitlistEntry.referrerId, user.id);
    }

    // ── Mark waitlist entry as converted ──────────────────────────────────
    if (waitlistEntry) {
      await this.waitlistRepo.update(
        { id: waitlistEntry.id },
        { status: WaitlistStatus.CONVERTED, convertedAt: new Date() },
      );
    }

    // ── Register device (upsert — idempotent on retry) ────────────────────
    await this.registerOrUpdateDeviceForUser(
      user.id,
      dto.deviceId,
      dto.devicePublicKey,
    );

    // ── Send verification OTP ─────────────────────────────────────────────
    const otpCode = await this.otpService.sendOtp(
      dto.email,
      OtpType.EMAIL_VERIFY,
      {
        fullName: dto.fullName,
      },
    );
    this.logger.log(`OTP sent [email=${dto.email}] [otp=${otpCode}]`);

    return { userId: user.id, email: user.email };
  }

  private async createEvmWalletsForUser(
    userId: string,
    username: string,
  ): Promise<{ walletAddress: string | null; allActive: boolean }> {
    if (this.blockchainWalletService) {
      await this.blockchainWalletService.createWallet(userId, username);
      const wallets = await this.blockchainWalletService.getWalletsForUser(userId);
      const depositChainIds = new Set(
        this.blockchainService
          .getConfiguredEvmDepositChains()
          .map((chain) => chain.chainId),
      );
      const targetWallets = wallets.filter(
        (wallet) =>
          depositChainIds.size === 0 || depositChainIds.has(wallet.chainId),
      );
      const activeWallets = targetWallets.filter(
        (wallet) =>
          wallet.status === BlockchainWalletStatus.ACTIVE && wallet.walletAddress,
      );

      return {
        walletAddress: activeWallets[0]?.walletAddress ?? null,
        allActive:
          targetWallets.length > 0 && activeWallets.length === targetWallets.length,
      };
    }

    const evmResult = await this.blockchainService.createEvmWallet(
      userId,
      username,
    );

    return { walletAddress: evmResult.walletAddress, allActive: true };
  }

  // ── Verify OTP ─────────────────────────────────────────────────────────────

  async verifyOtp(
    dto: VerifyOtpDto,
    meta: { userAgent?: string; ip?: string } = {},
  ) {
    const normalizedEmail = normalizeEmail(dto.email);
    await this.otpService.verifyOtp(normalizedEmail, dto.otp, dto.type);

    if (dto.type === OtpType.EMAIL_VERIFY) {
      await this.userRepo.update(
        { email: normalizedEmail },
        { emailVerified: true },
      );
      const user = await this.userRepo.findOne({
        where: { email: normalizedEmail },
      });
      if (!user) throw new NotFoundException('User not found');

      // Re-confirm the device registration (idempotent upsert).
      // Guards against the case where the signup request timed out before the
      // device row was committed — the OTP was still sent, so we re-upsert here.
      if (dto.deviceId && dto.devicePublicKey) {
        await this.registerOrUpdateDeviceForUser(
          user.id,
          dto.deviceId,
          dto.devicePublicKey,
        );
      }

      try {
        await this.emailService.sendSignupSuccess({
          to: user.email,
          fullName: user.fullName,
          username: user.username,
          appUrl: this.config.get('app.frontendUrl') + '/dashboard',
        });
        this.logger.log(`Welcome email delivered [user=${user.email}]`);
      } catch (err) {
        this.logger.error(
          `Welcome email failed [user=${user.email}]: ${(err as Error).message}`,
        );
        // Do NOT rethrow — tokens are still issued even if email fails
      }

      const tokens = await this.issueTokens(user, dto.deviceId ?? null, meta);
      return { user: this.sanitiseUser(user), tokens };
    }

    return { verified: true };
  }

  // ── Resend OTP ─────────────────────────────────────────────────────────────

  async resendOtp(email: string, type: OtpType): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });
    if (!user) throw new NotFoundException('User not found');
    await this.otpService.sendOtp(normalizedEmail, type, {
      fullName: user.fullName ?? undefined,
    });
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, meta: { userAgent?: string; ip?: string }) {
    const identifier = normalizeIdentifier(dto.identifier);
    const user = await this.userRepo.findOne({
      where: [{ email: identifier }, { username: identifier }],
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new ForbiddenException('Account suspended');

    if (!user.passwordHash)
      throw new UnauthorizedException('Invalid credentials');
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Invalid credentials');
    this.assertUserCanAuthenticate(user);

    const device = await this.deviceRepo.findOne({
      where: { deviceId: dto.deviceId, userId: user.id, isActive: true },
    });
    if (!device) throw new UnauthorizedException('Device not registered');

    // ── Key-recovery path ─────────────────────────────────────────────────
    // When the client's IndexedDB was cleared a fresh ECDSA key pair was
    // generated for the same deviceId.  We update the stored public key ONLY
    // after verifying: (a) credentials are valid (checked above), (b) the
    // deviceId already belongs to this user (checked above), and (c) the
    // signature is valid against the new public key (checked below).
    let verifyKey = device.publicKey;
    if (dto.keyRecovery && dto.newPublicKey) {
      await this.deviceRepo.update(
        { id: device.id },
        { publicKey: dto.newPublicKey },
      );
      verifyKey = dto.newPublicKey;
      this.logger.log(
        `Device key recovered [deviceId=${dto.deviceId}] [user=${user.id}]`,
      );
    }

    const signatureValid = this.blockchainService.verifyDeviceSignature({
      publicKey: verifyKey,
      signature: dto.deviceSignature,
      message: dto.deviceId,
    });
    if (
      !signatureValid &&
      !isInsecureDeviceSignatureBypassEnabled(this.config)
    ) {
      // If recovery just updated the key we need to roll back the change so we
      // don't leave a phantom key that could never be verified.
      if (dto.keyRecovery && dto.newPublicKey) {
        await this.deviceRepo.update(
          { id: device.id },
          { publicKey: device.publicKey },
        );
      }
      throw new UnauthorizedException('Invalid device signature');
    }

    await this.deviceRepo.update({ id: device.id }, { lastSeen: new Date() });

    const tokens = await this.issueTokens(user, dto.deviceId, meta);
    return { user: this.sanitiseUser(user), tokens };
  }

  // ── Refresh tokens ─────────────────────────────────────────────────────────

  async refresh(
    user: User,
    oldTokenHash: string,
    meta: { userAgent?: string; ip?: string },
  ) {
    const storedToken = await this.rtRepo.findOne({
      where: { tokenHash: oldTokenHash, userId: user.id, isRevoked: false },
    });
    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    await this.rtRepo.update({ id: storedToken.id }, { isRevoked: true });
    const tokens = await this.issueTokens(user, storedToken.deviceId, meta);
    return tokens;
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  async logout(userId: string, tokenHash: string): Promise<void> {
    await this.rtRepo.update({ userId, tokenHash }, { isRevoked: true });
  }

  // ── Forgot password ────────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const email = normalizeEmail(dto.email);
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) return; // don't reveal existence
    await this.otpService.sendOtp(email, OtpType.PASSWORD_RESET, {
      fullName: user.fullName ?? undefined,
    });
  }

  // ── Reset password ─────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const email = normalizeEmail(dto.email);
    await this.otpService.verifyOtp(email, dto.otp, OtpType.PASSWORD_RESET);

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userRepo.update({ email }, { passwordHash });

    const user = await this.userRepo.findOne({ where: { email } });
    if (user) {
      this.emailService
        .sendPasswordChanged({ to: email, fullName: user.fullName })
        .catch((err) =>
          this.logger.error(
            `Password changed email failed: ${(err as Error).message}`,
          ),
        );

      // Revoke all refresh tokens on password change
      await this.rtRepo.update({ userId: user.id }, { isRevoked: true });
    }
  }

  // ── Reset PIN (clear stored hash so user can set a fresh one) ────────────

  async resetPin(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.update({ id: userId }, { pinHash: null });
  }

  // ── Set PIN (first-time only) ──────────────────────────────────────────────

  async setPin(userId: string, dto: SetPinDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.pinHash) {
      throw new BadRequestException(
        'PIN already set — use POST /auth/change-pin to update it',
      );
    }
    await this.userRepo.update({ id: userId }, { pinHash: dto.pinHash });
  }

  // ── Verify PIN ─────────────────────────────────────────────────────────────

  async verifyPin(
    userId: string,
    dto: VerifyPinDto,
  ): Promise<{ valid: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.pinHash) throw new BadRequestException('PIN not set');

    const isValid = timingSafeEqual(
      Buffer.from(user.pinHash),
      Buffer.from(dto.pinHash),
    );
    if (!isValid) throw new ForbiddenException('Incorrect PIN');

    return { valid: true };
  }

  // ── Change PIN ─────────────────────────────────────────────────────────────

  async changePin(userId: string, dto: ChangePinDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.pinHash) {
      const isValid = timingSafeEqual(
        Buffer.from(user.pinHash),
        Buffer.from(dto.currentPinHash),
      );
      if (!isValid) throw new ForbiddenException('Incorrect current PIN');
    }

    await this.userRepo.update({ id: userId }, { pinHash: dto.newPinHash });
  }

  // ── Get current user ───────────────────────────────────────────────────────

  getMe(user: User) {
    return this.sanitiseUser(user);
  }

  // ── Request device registration — magic link ──────────────────────────────
  // Generates a short-lived signed token and emails a clickable link.
  // The link opens /add-device?token=<jwt> on the new device, which then
  // generates its own deviceId + key pair and calls complete-link.

  async requestDeviceRegistration(email: string): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });
    if (!user || !user.emailVerified) return; // silent — prevent enumeration

    const token = this.jwtService.sign(
      { sub: user.id, purpose: 'device-registration' },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: '30m',
      },
    );

    const frontendUrl = this.config.get<string>(
      'app.frontendUrl',
      'https://cheesepay.xyz',
    );
    const link = `${frontendUrl}/add-device?token=${token}`;

    await this.emailService.sendDeviceRegistrationLink({
      to: email,
      fullName: user.fullName ?? email,
      link,
    });
  }

  // ── Complete device registration (OTP — kept for backwards compat) ─────────

  async completeDeviceRegistration(
    dto: CompleteDeviceRegistrationDto,
  ): Promise<void> {
    const email = normalizeEmail(dto.email);
    await this.otpService.verifyOtp(email, dto.otp, OtpType.DEVICE_REGISTER);

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new NotFoundException('User not found');
    this.assertUserCanAuthenticate(user);

    await this.registerOrUpdateDeviceForUser(
      user.id,
      dto.deviceId,
      dto.publicKey,
    );
  }

  // ── Complete device registration — magic link ──────────────────────────────

  async completeDeviceRegistrationByLink(
    dto: CompleteDeviceRegistrationByLinkDto,
  ): Promise<void> {
    // Verify token and extract userId
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwtService.verify(dto.token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new BadRequestException('Link is invalid or has expired');
    }

    if (payload.purpose !== 'device-registration') {
      throw new BadRequestException('Link is invalid or has expired');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new NotFoundException('User not found');
    this.assertUserCanAuthenticate(user);

    await this.registerOrUpdateDeviceForUser(
      user.id,
      dto.deviceId,
      dto.publicKey,
    );
  }

  // ── Private: award referral points ────────────────────────────────────────

  private async awardReferralPoints(
    referrerId: string,
    newUserId: string,
  ): Promise<void> {
    try {
      const referrerUser = await this.userRepo.findOne({
        where: { id: referrerId },
      });

      if (referrerUser) {
        await this.userRepo.increment(
          { id: referrerId },
          'points',
          REFERRAL_POINTS,
        );
        await this.referralEventRepo.save(
          this.referralEventRepo.create({
            referrerUserId: referrerId,
            referredUserId: newUserId,
            referredType: 'user',
            pointsAwarded: REFERRAL_POINTS,
          }),
        );
        this.logger.log(
          `Referral points awarded [referrer=${referrerId}] [newUser=${newUserId}] [pts=${REFERRAL_POINTS}]`,
        );
      } else {
        // Referrer is still a waitlist entry
        await this.waitlistRepo.increment(
          { id: referrerId },
          'points',
          REFERRAL_POINTS,
        );
        await this.referralEventRepo.save(
          this.referralEventRepo.create({
            referrerWaitlistId: referrerId,
            referredUserId: newUserId,
            referredType: 'user',
            pointsAwarded: REFERRAL_POINTS,
          }),
        );
        this.logger.log(
          `Waitlist referral points awarded [referrer=${referrerId}] [newUser=${newUserId}] [pts=${REFERRAL_POINTS}]`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to award referral points: ${(err as Error).message}`,
      );
      // Never block signup for referral failures
    }
  }

  // ── Private: token issuance ────────────────────────────────────────────────

  private async issueTokens(
    user: User,
    deviceId: string | null,
    meta: { userAgent?: string; ip?: string },
  ) {
    this.assertUserCanAuthenticate(user);

    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('jwt.accessSecret'),
      expiresIn: this.config.get('jwt.accessExpires'),
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, jti: randomUUID() },
      {
        secret: this.config.get('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshExpires'),
      },
    );

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    const expiresAt = new Date(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.jwtService.decode(refreshToken).exp * 1000,
    );

    await this.rtRepo.save(
      this.rtRepo.create({
        userId: user.id,
        tokenHash,
        deviceId,
        expiresAt,
        userAgent: meta.userAgent || null,
        ipAddress: meta.ip || null,
      }),
    );

    return { accessToken, refreshToken };
  }

  // ── Private: sanitise user for API response ────────────────────────────────

  private sanitiseUser(
    user: User,
  ): Omit<
    User,
    'passwordHash' | 'pinHash' | 'stellarSecretEnc' | 'normalizeIdentityFields'
  > & { hasPin: boolean } {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, pinHash, stellarSecretEnc, ...safe } =
      user as User & {
        passwordHash: string;
        pinHash: string;
        stellarSecretEnc: string;
      };
    return { ...safe, hasPin: !!pinHash };
  }

  private normalizeSignupDto(dto: SignupDto): SignupDto {
    return {
      ...dto,
      fullName: dto.fullName.trim(),
      email: normalizeEmail(dto.email),
      phone: dto.phone.trim(),
      username: normalizeUsername(dto.username),
      referralCode: dto.referralCode?.trim(),
    };
  }

  private assertUserCanAuthenticate(user: User): void {
    if (!user.isActive) throw new ForbiddenException('Account suspended');
    if (!user.emailVerified) {
      throw new ForbiddenException({
        message: 'Email not verified. Verify your email to continue.',
        error: 'EMAIL_NOT_VERIFIED',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }
  }

  private async registerOrUpdateDeviceForUser(
    userId: string,
    deviceId: string,
    publicKey: string,
    deviceName = 'Primary Device',
  ): Promise<void> {
    const existingDevice = await this.deviceRepo.findOne({
      where: { deviceId },
    });

    if (existingDevice) {
      if (existingDevice.userId !== userId) {
        throw new ConflictException('Device already registered');
      }

      await this.deviceRepo.update(
        { id: existingDevice.id },
        { publicKey, deviceName, isActive: true },
      );
      return;
    }

    await this.deviceRepo.save(
      this.deviceRepo.create({
        userId,
        deviceId,
        publicKey,
        deviceName,
      }),
    );
  }
}
