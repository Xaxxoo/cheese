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
import { ethers } from 'ethers';
import { createHash, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { OtpService } from '../otp/otp.service';
import { OtpType } from '../otp/entities/otp.entity';
import { Device } from '../devices/entities/device.entity';
import {
  ChangePinDto,
  SetPinDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SignupDto,
  VerifyOtpDto,
  VerifyPinDto,
} from './dto';
import { EmailService } from '../email/email.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import {
  WaitlistEntry,
  WaitlistStatus,
} from '../waitlist/entities/waitlist-entry.entity';
import {
  ReferralEvent,
  REFERRAL_POINTS,
} from '../waitlist/entities/referral-event.entity';
import { nanoid } from 'nanoid';
import { ReferralService } from '../referral/referral.service';

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
    private readonly emailService: EmailService,
    private readonly waitlistService: WaitlistService,

    @Optional()
    private readonly referralService: ReferralService | null,
  ) {}

  // ── Signup ─────────────────────────────────────────────────────────────────

  async signup(dto: SignupDto): Promise<{ userId: string; email: string }> {
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email, emailVerified: true },
    });
    if (existingUser) throw new ConflictException('Email already registered');

    const waitlistEntry = await this.waitlistRepo.findOne({
      where: { email: dto.email },
    });

    if (waitlistEntry) {
      if (waitlistEntry.username !== dto.username) {
        throw new ConflictException(
          'Username does not match waitlist reservation',
        );
      }
      if (waitlistEntry.status === WaitlistStatus.CONVERTED) {
        // If the user was deleted from the DB, allow re-signup by resetting the waitlist entry
        const userExists = await this.userRepo.findOne({
          where: { email: dto.email },
        });
        if (userExists)
          throw new ConflictException('This email has already been converted');
        await this.waitlistRepo.update(
          { id: waitlistEntry.id },
          { status: WaitlistStatus.PENDING },
        );
        waitlistEntry.status = WaitlistStatus.PENDING;
      }
      return this.createUserFromWaitlist(dto, waitlistEntry);
    }

    // Allow open signup when SIGNUP_OPEN=true (set in Railway env vars)
    if (process.env.SIGNUP_OPEN === 'true') {
      return this.createUserFromWaitlist(dto, null);
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
      // Previous attempt created the user but OTP was never verified.
      // Re-send the OTP and return so the user can complete verification.
      await this.otpService.sendOtp(dto.email, OtpType.EMAIL_VERIFY, {
        fullName: existingUnverified.fullName ?? undefined,
      });
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
      passwordHash,
      referralCode: nanoid(8),
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

    // EVM — generate a custodial keypair for the user, then register it on the contract
    try {
      // For custodial EVM wallets: the platform generates a fresh keypair.
      // The user's EVM address is derived from this keypair.
      // In a non-custodial flow the user would provide their own address.
      const evmKeypair = ethers.Wallet.createRandom();

      const evmResult = await this.blockchainService.createEvmWallet(
        evmKeypair.address,
        dto.username,
      );

      user.evmAddress = evmResult.walletAddress; // contract-managed wallet address
      this.logger.log(
        `EVM wallet created [user=${dto.username}]` +
          ` [contractWallet=${evmResult.walletAddress}] [txHash=${evmResult.txHash}]`,
      );
    } catch (err) {
      this.logger.error(
        `EVM wallet creation failed [user=${dto.username}]: ${(err as Error).message}`,
      );
      failedChains.push('evm');
      // user.evmAddress remains null — retried by job
    }

    await this.userRepo.save(user);

    // ── Link app referral (Phase 7) ───────────────────────────────────────
    if (dto.referralCode && this.referralService) {
      await this.referralService
        .linkReferral(user.id, dto.referralCode)
        .catch(() => {});
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
    await this.deviceRepo.upsert(
      {
        userId: user.id,
        deviceId: dto.deviceId,
        publicKey: dto.devicePublicKey,
        deviceName: 'Primary Device',
      },
      { conflictPaths: ['deviceId'] },
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

  // ── Verify OTP ─────────────────────────────────────────────────────────────

  async verifyOtp(
    dto: VerifyOtpDto,
    meta: { userAgent?: string; ip?: string } = {},
  ) {
    await this.otpService.verifyOtp(dto.email, dto.otp, dto.type);

    if (dto.type === OtpType.EMAIL_VERIFY) {
      await this.userRepo.update({ email: dto.email }, { emailVerified: true });
      const user = await this.userRepo.findOne({ where: { email: dto.email } });
      if (!user) throw new NotFoundException('User not found');

      try {
        await this.emailService.sendSignupSuccess({
          to: user.email,
          fullName: user.fullName,
          username: user.username,
          appUrl: this.config.get('app.frontendUrl') + '/wallet',
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
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new NotFoundException('User not found');
    await this.otpService.sendOtp(email, type);
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, meta: { userAgent?: string; ip?: string }) {
    const user = await this.userRepo.findOne({
      where: [{ email: dto.identifier }, { username: dto.identifier }],
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new ForbiddenException('Account suspended');

    if (!user.passwordHash)
      throw new UnauthorizedException('Invalid credentials');
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Invalid credentials');

    const device = await this.deviceRepo.findOne({
      where: { deviceId: dto.deviceId, userId: user.id, isActive: true },
    });
    if (!device) throw new UnauthorizedException('Device not registered');

    const signatureValid = this.blockchainService.verifyDeviceSignature({
      publicKey: device.publicKey,
      signature: dto.deviceSignature,
      message: dto.deviceId,
    });
    if (!signatureValid && this.config.get('app.nodeEnv') === 'production') {
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
    await this.rtRepo.update({ tokenHash: oldTokenHash }, { isRevoked: true });
    const tokens = await this.issueTokens(user, null, meta);
    return { accessToken: tokens.accessToken };
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  async logout(userId: string, tokenHash: string): Promise<void> {
    await this.rtRepo.update({ userId, tokenHash }, { isRevoked: true });
  }

  // ── Forgot password ────────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) return; // don't reveal existence
    await this.otpService.sendOtp(dto.email, OtpType.PASSWORD_RESET);
  }

  // ── Reset password ─────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    await this.otpService.verifyOtp(dto.email, dto.otp, OtpType.PASSWORD_RESET);

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userRepo.update({ email: dto.email }, { passwordHash });

    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (user) {
      this.emailService
        .sendPasswordChanged({ to: dto.email, fullName: user.fullName })
        .catch((err) =>
          this.logger.error(
            `Password changed email failed: ${(err as Error).message}`,
          ),
        );

      // Revoke all refresh tokens on password change
      await this.rtRepo.update({ userId: user.id }, { isRevoked: true });
    }
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
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('jwt.accessSecret'),
      expiresIn: this.config.get('jwt.accessExpires'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('jwt.refreshSecret'),
      expiresIn: this.config.get('jwt.refreshExpires'),
    });

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
  ): Omit<User, 'passwordHash' | 'pinHash' | 'stellarSecretEnc'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, pinHash, stellarSecretEnc, ...safe } =
      user as User & {
        passwordHash: string;
        pinHash: string;
        stellarSecretEnc: string;
      };
    return safe;
  }
}
