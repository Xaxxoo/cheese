import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Merchant, MerchantKybStatus, MerchantKycStatus, MerchantType, PayoutSchedule, SettlementMode } from './entities/merchant.entity';
import { MerchantUser, MerchantRole } from './entities/merchant-user.entity';
import { MerchantRefreshToken } from './entities/merchant-refresh-token.entity';
import { MerchantStore } from './entities/merchant-store.entity';
import { Otp, OtpType } from '../otp/entities/otp.entity';
import { EmailService } from '../email/email.service';
import { MerchantRegisterDto } from './dto/merchant-register.dto';
import { MerchantLoginDto } from './dto/merchant-login.dto';
import { MerchantVerifyEmailDto } from './dto/merchant-verify-email.dto';
import { MerchantTwoFactorDto } from './dto/merchant-2fa.dto';
import { MerchantOnboardingDto } from './dto/merchant-onboarding.dto';
import type { MerchantJwtContext } from './strategies/merchant-jwt.strategy';

const MERCHANT_EMAIL_VERIFY = 'merchant_email_verify';
const MERCHANT_2FA = 'merchant_2fa';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

@Injectable()
export class MerchantAuthService {
  constructor(
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,

    @InjectRepository(MerchantUser)
    private readonly merchantUserRepo: Repository<MerchantUser>,

    @InjectRepository(MerchantRefreshToken)
    private readonly merchantRtRepo: Repository<MerchantRefreshToken>,

    @InjectRepository(MerchantStore)
    private readonly merchantStoreRepo: Repository<MerchantStore>,

    @InjectRepository(Otp)
    private readonly otpRepo: Repository<Otp>,

    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // ── Register ──────────────────────────────────────────────────────────────

  async register(dto: MerchantRegisterDto): Promise<{ email: string; verificationSent: boolean }> {
    const existing = await this.merchantUserRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const merchant = this.merchantRepo.create({
      displayName: dto.businessName,
      country: dto.country,
      baseCurrency: dto.baseCurrency,
      defaultSettlementMode: dto.settlementMode as SettlementMode,
      kycStatus: MerchantKycStatus.NOT_STARTED,
      kybStatus: dto.settlementMode === 'instant_fiat'
        ? MerchantKybStatus.REVIEW
        : MerchantKybStatus.NOT_REQUIRED,
      sandboxMode: true,
      onboardingComplete: false,
    });
    const savedMerchant = await this.merchantRepo.save(merchant);

    const merchantUser = this.merchantUserRepo.create({
      merchantId: savedMerchant.id,
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      passwordHash,
      role: MerchantRole.OWNER,
      permissions: [],
      emailVerified: false,
      isActive: true,
    });
    await this.merchantUserRepo.save(merchantUser);

    await this.sendOtp(dto.email.toLowerCase(), MERCHANT_EMAIL_VERIFY, dto.fullName);

    return { email: dto.email.toLowerCase(), verificationSent: true };
  }

  // ── Verify email ──────────────────────────────────────────────────────────

  async verifyEmail(dto: MerchantVerifyEmailDto): Promise<{ verified: boolean; email: string }> {
    await this.consumeOtp(dto.email.toLowerCase(), dto.code, MERCHANT_EMAIL_VERIFY);

    const user = await this.merchantUserRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) throw new UnauthorizedException('Account not found.');

    user.emailVerified = true;
    await this.merchantUserRepo.save(user);

    return { verified: true, email: dto.email.toLowerCase() };
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(
    dto: MerchantLoginDto,
  ): Promise<{ challengeId: string; email: string; method: string }> {
    const user = await this.merchantUserRepo.findOne({
      where: { email: dto.email.toLowerCase(), isActive: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials.');

    if (!user.emailVerified) {
      throw new BadRequestException('Please verify your email address first.');
    }

    const challengeId = randomBytes(16).toString('hex');
    await this.sendOtp(user.email, MERCHANT_2FA, user.fullName);

    return { challengeId, email: user.email, method: 'email_otp' };
  }

  // ── Complete 2FA ──────────────────────────────────────────────────────────

  async completeTwoFactor(
    dto: MerchantTwoFactorDto,
    meta: { userAgent?: string; ip?: string },
  ): Promise<Record<string, unknown>> {
    await this.consumeOtp(dto.email.toLowerCase(), dto.code, MERCHANT_2FA);

    const user = await this.merchantUserRepo.findOne({
      where: { email: dto.email.toLowerCase(), isActive: true },
    });
    if (!user) throw new UnauthorizedException('Account not found.');

    const merchant = await this.merchantRepo.findOne({
      where: { id: user.merchantId, isActive: true },
      relations: ['stores'],
    });
    if (!merchant) throw new UnauthorizedException('Merchant account not found.');

    user.lastLoginAt = new Date();
    await this.merchantUserRepo.save(user);

    const { accessToken, refreshToken } = await this.issueTokens(user, merchant, meta);

    return {
      accessToken,
      refreshToken,
      sandboxMode: merchant.sandboxMode,
      onboardingComplete: merchant.onboardingComplete,
      user: this.sanitiseUser(user),
      merchant: this.sanitiseMerchant(merchant),
    };
  }

  // ── Onboarding ────────────────────────────────────────────────────────────

  async completeOnboarding(
    ctx: MerchantJwtContext,
    dto: MerchantOnboardingDto,
  ): Promise<Record<string, unknown>> {
    const { merchant } = ctx;

    merchant.merchantType = dto.merchantType as MerchantType;
    merchant.country = dto.country;
    merchant.baseCurrency = dto.baseCurrency;
    merchant.defaultSettlementMode = dto.settlementMode as SettlementMode;
    merchant.payoutSchedule = dto.payoutSchedule as PayoutSchedule;
    merchant.onboardingComplete = true;
    await this.merchantRepo.save(merchant);

    // Create first store if one doesn't exist
    const existingStore = await this.merchantStoreRepo.findOne({
      where: { merchantId: merchant.id },
    });
    if (!existingStore) {
      const slug = dto.storeName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 40);
      const uniqueSlug = `${slug}-${Date.now().toString(36)}`;

      await this.merchantStoreRepo.save(
        this.merchantStoreRepo.create({
          merchantId: merchant.id,
          name: dto.storeName,
          slug: uniqueSlug,
          currency: dto.baseCurrency,
          settlementMode: dto.settlementMode as SettlementMode,
        }),
      );
    }

    const updatedMerchant = await this.merchantRepo.findOne({
      where: { id: merchant.id },
      relations: ['stores'],
    });

    return {
      onboardingComplete: true,
      merchant: this.sanitiseMerchant(updatedMerchant!),
    };
  }

  // ── Me ────────────────────────────────────────────────────────────────────

  async getMe(ctx: MerchantJwtContext): Promise<Record<string, unknown>> {
    const merchant = await this.merchantRepo.findOne({
      where: { id: ctx.merchant.id },
      relations: ['stores'],
    });
    return {
      user: this.sanitiseUser(ctx.user),
      merchant: this.sanitiseMerchant(merchant ?? ctx.merchant),
      sandboxMode: (merchant ?? ctx.merchant).sandboxMode,
      onboardingComplete: (merchant ?? ctx.merchant).onboardingComplete,
    };
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  async refresh(
    oldRefreshToken: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = createHash('sha256').update(oldRefreshToken).digest('hex');

    const stored = await this.merchantRtRepo.findOne({
      where: { tokenHash, isRevoked: false },
      relations: ['merchantUser'],
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid or expired.');
    }

    const merchant = await this.merchantRepo.findOne({
      where: { id: stored.merchantUser.merchantId, isActive: true },
      relations: ['stores'],
    });
    if (!merchant) throw new UnauthorizedException('Merchant account not found.');

    await this.merchantRtRepo.update({ tokenHash }, { isRevoked: true });
    return this.issueTokens(stored.merchantUser, merchant, meta);
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.merchantRtRepo.update({ tokenHash }, { isRevoked: true });
  }

  // ── Forgot password ───────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<{ sent: boolean }> {
    const user = await this.merchantUserRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (user) {
      await this.sendOtp(user.email, 'merchant_password_reset' as OtpType, user.fullName);
    }
    return { sent: true }; // Always return true to prevent email enumeration
  }

  // ── Sanitise helpers ──────────────────────────────────────────────────────

  sanitiseUser(user: MerchantUser) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      permissions: user.permissions ?? [],
      twoFactorEnabled: user.twoFactorEnabled,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
  }

  sanitiseMerchant(merchant: Merchant) {
    return {
      id: merchant.id,
      merchantType: merchant.merchantType,
      displayName: merchant.displayName,
      legalName: merchant.legalName,
      country: merchant.country,
      baseCurrency: merchant.baseCurrency,
      defaultSettlementMode: merchant.defaultSettlementMode,
      payoutSchedule: merchant.payoutSchedule,
      kycStatus: merchant.kycStatus,
      kybStatus: merchant.kybStatus,
      stores: (merchant.stores ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        location: s.location,
        currency: s.currency,
        settlementMode: s.settlementMode,
        payoutsEnabled: s.payoutsEnabled,
      })),
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async issueTokens(
    user: MerchantUser,
    merchant: Merchant,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      isMerchant: true as const,
      merchantId: merchant.id,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('jwt.accessSecret'),
      expiresIn: '8h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('jwt.refreshSecret'),
      expiresIn: '30d',
    });

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const expiresAt = new Date(this.jwtService.decode(refreshToken).exp * 1000);

    await this.merchantRtRepo.save(
      this.merchantRtRepo.create({
        merchantUserId: user.id,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ip ?? null,
      }),
    );

    return { accessToken, refreshToken };
  }

  private async sendOtp(email: string, type: string, fullName: string): Promise<void> {
    // Invalidate any existing unused OTPs of the same type
    await this.otpRepo
      .createQueryBuilder()
      .update(Otp)
      .set({ isUsed: true })
      .where('email = :email AND type = :type AND is_used = false', { email, type })
      .execute();

    const code = generateOtp();
    const codeHash = hashOtp(code);
    const ttl = this.config.get<number>('otp.ttlSeconds', 300);

    await this.otpRepo.save(
      this.otpRepo.create({
        email,
        codeHash,
        type: type as OtpType,
        expiresAt: new Date(Date.now() + ttl * 1000),
        isUsed: false,
        attempts: 0,
      }),
    );

    await this.emailService.sendSignupOtp({
      to: email,
      fullName,
      otp: code,
      expiresIn: `${Math.round(ttl / 60)} minutes`,
    });
  }

  private async consumeOtp(email: string, code: string, type: string): Promise<void> {
    const codeHash = hashOtp(code);

    const otp = await this.otpRepo.findOne({
      where: { email, codeHash, type: type as OtpType, isUsed: false },
    });

    if (!otp) {
      throw new UnauthorizedException('Invalid or expired verification code.');
    }

    if (otp.expiresAt < new Date()) {
      throw new UnauthorizedException('Verification code has expired.');
    }

    otp.isUsed = true;
    await this.otpRepo.save(otp);
  }
}
