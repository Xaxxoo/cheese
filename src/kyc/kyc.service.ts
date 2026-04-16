// src/kyc/kyc.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, KycStatus, Tier } from '../auth/entities/user.entity';
import { EmailService } from '../email/email.service';
import { DojahClient } from './dojah.client';
import {
  KycAttempt,
  KycAttemptType,
  KycAttemptStatus,
} from './entities/kyc-attempt.entity';

const SELFIE_MATCH_THRESHOLD = 70; // minimum Dojah confidence score (%)

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(KycAttempt)
    private readonly attemptRepo: Repository<KycAttempt>,
    private readonly dojah: DojahClient,
    private readonly emailService: EmailService,
  ) {}

  // ── BVN verification ────────────────────────────────────────────────────────

  async verifyBvn(
    userId: string,
    bvn: string,
  ): Promise<{ status: string; message: string }> {
    this.requireDojah();

    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    this.guardAlreadyVerified(user);
    await this.guardDuplicateAttempt(userId, KycAttemptType.BVN);

    let result: Awaited<ReturnType<DojahClient['lookupBvn']>>;
    try {
      result = await this.dojah.lookupBvn(bvn);
    } catch (err) {
      await this.recordAttempt({
        userId,
        type: KycAttemptType.BVN,
        status: KycAttemptStatus.FAILED,
        documentSuffix: bvn.slice(-4),
        errorMessage: (err as Error).message,
        rawResponse: null,
      });
      throw new BadRequestException(
        `BVN verification failed: ${(err as Error).message}`,
      );
    }

    // Store attempt — strip the photo before saving
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { image: _image, ...safeResult } = result;
    await this.recordAttempt({
      userId,
      type: KycAttemptType.BVN,
      status: KycAttemptStatus.VERIFIED,
      documentSuffix: bvn.slice(-4),
      errorMessage: null,
      rawResponse: safeResult as Record<string, unknown>,
    });

    await this.userRepo.update(userId, { kycStatus: KycStatus.VERIFIED });

    this.logger.log(`BVN verified [userId=${userId}]`);

    await this.sendApprovedEmail(user).catch((e) =>
      this.logger.warn(
        `KYC approval email failed [userId=${userId}]: ${(e as Error).message}`,
      ),
    );

    return { status: 'verified', message: 'BVN verified successfully.' };
  }

  // ── NIN verification ────────────────────────────────────────────────────────

  async verifyNin(
    userId: string,
    nin: string,
  ): Promise<{ status: string; message: string }> {
    this.requireDojah();

    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    this.guardAlreadyVerified(user);
    await this.guardDuplicateAttempt(userId, KycAttemptType.NIN);

    let result: Awaited<ReturnType<DojahClient['lookupNin']>>;
    try {
      result = await this.dojah.lookupNin(nin);
    } catch (err) {
      await this.recordAttempt({
        userId,
        type: KycAttemptType.NIN,
        status: KycAttemptStatus.FAILED,
        documentSuffix: nin.slice(-4),
        errorMessage: (err as Error).message,
        rawResponse: null,
      });
      throw new BadRequestException(
        `NIN verification failed: ${(err as Error).message}`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { photo: _photo, ...safeResult } = result;
    await this.recordAttempt({
      userId,
      type: KycAttemptType.NIN,
      status: KycAttemptStatus.VERIFIED,
      documentSuffix: nin.slice(-4),
      errorMessage: null,
      rawResponse: safeResult as Record<string, unknown>,
    });

    await this.userRepo.update(userId, { kycStatus: KycStatus.VERIFIED });

    this.logger.log(`NIN verified [userId=${userId}]`);

    await this.sendApprovedEmail(user).catch((e) =>
      this.logger.warn(
        `KYC approval email failed [userId=${userId}]: ${(e as Error).message}`,
      ),
    );

    return { status: 'verified', message: 'NIN verified successfully.' };
  }

  // ── Selfie / face-match (upgrades to Gold tier) ─────────────────────────────

  async verifySelfie(
    userId: string,
    selfieImage: string,
    bvn: string,
  ): Promise<{ status: string; tier: string; message: string }> {
    this.requireDojah();

    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    if (user.kycStatus !== KycStatus.VERIFIED) {
      throw new BadRequestException(
        'Complete BVN or NIN verification before submitting a selfie.',
      );
    }

    if (user.tier === Tier.GOLD || user.tier === Tier.BLACK) {
      throw new ConflictException(
        'Your account is already at Gold tier or above.',
      );
    }

    await this.guardDuplicateAttempt(userId, KycAttemptType.SELFIE);

    let result: Awaited<ReturnType<DojahClient['verifySelfie']>>;
    try {
      result = await this.dojah.verifySelfie(selfieImage, bvn);
    } catch (err) {
      await this.recordAttempt({
        userId,
        type: KycAttemptType.SELFIE,
        status: KycAttemptStatus.FAILED,
        documentSuffix: bvn.slice(-4),
        errorMessage: (err as Error).message,
        rawResponse: null,
      });
      throw new BadRequestException(
        `Selfie verification failed: ${(err as Error).message}`,
      );
    }

    if (!result.match || result.confidence < SELFIE_MATCH_THRESHOLD) {
      await this.recordAttempt({
        userId,
        type: KycAttemptType.SELFIE,
        status: KycAttemptStatus.FAILED,
        documentSuffix: bvn.slice(-4),
        errorMessage: `Face match failed (confidence=${result.confidence})`,
        rawResponse: result as unknown as Record<string, unknown>,
      });
      throw new BadRequestException(
        'Face match failed. Please ensure good lighting and try again.',
      );
    }

    await this.recordAttempt({
      userId,
      type: KycAttemptType.SELFIE,
      status: KycAttemptStatus.VERIFIED,
      documentSuffix: bvn.slice(-4),
      errorMessage: null,
      rawResponse: result as unknown as Record<string, unknown>,
    });

    await this.userRepo.update(userId, { tier: Tier.GOLD });

    this.logger.log(
      `Selfie verified — upgraded to Gold [userId=${userId}] [confidence=${result.confidence}]`,
    );

    return {
      status: 'verified',
      tier: Tier.GOLD,
      message: 'Face verified. Your account has been upgraded to Gold.',
    };
  }

  // ── Document verification (Black tier prerequisite) ─────────────────────────

  async verifyDocument(
    userId: string,
    documentImage: string,
    documentType: 'passport' | 'drivers_license' | 'nin_slip',
  ): Promise<{ status: string; message: string }> {
    this.requireDojah();

    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    if (user.tier !== Tier.GOLD) {
      throw new BadRequestException(
        'Document verification is only available for Gold tier users upgrading to Black.',
      );
    }
    if (user.pendingBlackApproval) {
      throw new ConflictException(
        'Your document is already submitted and pending admin review.',
      );
    }

    await this.guardDuplicateAttempt(userId, KycAttemptType.DOCUMENT);

    let result: Awaited<ReturnType<DojahClient['verifyDocument']>>;
    try {
      result = await this.dojah.verifyDocument(documentImage, documentType);
    } catch (err) {
      await this.recordAttempt({
        userId,
        type: KycAttemptType.DOCUMENT,
        status: KycAttemptStatus.FAILED,
        documentSuffix: null,
        errorMessage: (err as Error).message,
        rawResponse: null,
      });
      throw new BadRequestException(
        `Document verification failed: ${(err as Error).message}`,
      );
    }

    if (!result.valid) {
      await this.recordAttempt({
        userId,
        type: KycAttemptType.DOCUMENT,
        status: KycAttemptStatus.FAILED,
        documentSuffix: result.documentNo?.slice(-4) ?? null,
        errorMessage: 'Document could not be validated',
        rawResponse: result as unknown as Record<string, unknown>,
      });
      throw new BadRequestException(
        'Document could not be validated. Please ensure the image is clear and try again.',
      );
    }

    // Strip sensitive data before storing
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { documentNo: _docNo, ...safeResult } = result;
    await this.recordAttempt({
      userId,
      type: KycAttemptType.DOCUMENT,
      status: KycAttemptStatus.VERIFIED,
      documentSuffix: result.documentNo?.slice(-4) ?? null,
      errorMessage: null,
      rawResponse: safeResult as Record<string, unknown>,
    });

    // Mark pending admin approval — admin must approve before Black is granted
    await this.userRepo.update(userId, { pendingBlackApproval: true });

    this.logger.log(
      `Document verified — pending admin approval for Black [userId=${userId}]`,
    );

    return {
      status: 'pending_approval',
      message:
        'Document verified successfully. Your account is pending admin review for Black tier upgrade. You will be notified by email.',
    };
  }

  // ── Admin: approve Black tier ────────────────────────────────────────────────

  async adminApproveBlack(
    userId: string,
  ): Promise<{ status: string; message: string }> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    if (!user.pendingBlackApproval) {
      throw new BadRequestException(
        'This user has no pending Black tier approval request.',
      );
    }
    if (user.tier === Tier.BLACK) {
      throw new ConflictException('User is already on Black tier.');
    }

    await this.userRepo.update(userId, {
      tier: Tier.BLACK,
      pendingBlackApproval: false,
    });

    this.logger.log(`Black tier approved by admin [userId=${userId}]`);

    await this.emailService
      .sendTierUpgrade({
        to: user.email,
        fullName: user.fullName ?? user.username,
        fromTier: Tier.GOLD,
        toTier: Tier.BLACK,
      })
      .catch((e) =>
        this.logger.warn(
          `Black upgrade email failed [userId=${userId}]: ${(e as Error).message}`,
        ),
      );

    return {
      status: 'approved',
      message: `User ${userId} upgraded to Black tier.`,
    };
  }

  // ── Admin: reject Black tier ─────────────────────────────────────────────────

  async adminRejectBlack(
    userId: string,
    reason: string,
  ): Promise<{ status: string; message: string }> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    if (!user.pendingBlackApproval) {
      throw new BadRequestException(
        'This user has no pending Black tier approval request.',
      );
    }

    await this.userRepo.update(userId, { pendingBlackApproval: false });

    this.logger.log(
      `Black tier rejected by admin [userId=${userId}] [reason=${reason}]`,
    );

    return {
      status: 'rejected',
      message: `Black tier request for user ${userId} rejected.`,
    };
  }

  // ── Status ──────────────────────────────────────────────────────────────────

  async getStatus(userId: string): Promise<{
    kycStatus: string;
    tier: string;
    attempts: { type: string; status: string; createdAt: Date }[];
  }> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    const attempts = await this.attemptRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      select: ['type', 'status', 'createdAt'],
    });

    return {
      kycStatus: user.kycStatus,
      tier: user.tier,
      attempts,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private requireDojah(): void {
    if (!this.dojah.isReady) {
      throw new ServiceUnavailableException(
        'KYC service is temporarily unavailable. Please try again later.',
      );
    }
  }

  private guardAlreadyVerified(user: User): void {
    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new ConflictException('Your identity has already been verified.');
    }
  }

  private async guardDuplicateAttempt(
    userId: string,
    type: KycAttemptType,
  ): Promise<void> {
    const prior = await this.attemptRepo.findOne({
      where: { userId, type, status: KycAttemptStatus.VERIFIED },
    });
    if (prior) {
      throw new ConflictException(`${type.toUpperCase()} already verified.`);
    }
  }

  private async recordAttempt(params: {
    userId: string;
    type: KycAttemptType;
    status: KycAttemptStatus;
    documentSuffix: string | null;
    errorMessage: string | null;
    rawResponse: Record<string, unknown> | null;
  }): Promise<void> {
    await this.attemptRepo.save(this.attemptRepo.create(params));
  }

  private async sendApprovedEmail(user: User): Promise<void> {
    if (!user.email) return;
    await this.emailService.sendKycApproved({
      to: user.email,
      fullName: user.fullName ?? user.username,
      tier: user.tier,
    });
  }
}
