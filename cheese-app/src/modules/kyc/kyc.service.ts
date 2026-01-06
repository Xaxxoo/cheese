import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycVerification, KycStatus, KycLevel } from '../entities/kyc.entity';
import {
  InitiateKycDto,
  UpdateKycDto,
  ManualReviewDto,
  QueryKycDto,
} from '../dto/kyc.dto';
import { KycProviderService } from './kyc-provider.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    @InjectRepository(KycVerification)
    private readonly kycRepository: Repository<KycVerification>,
    private readonly kycProviderService: KycProviderService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Initiate KYC verification process
   */
  async initiateKyc(dto: InitiateKycDto): Promise<KycVerification> {
    this.logger.log(`Initiating KYC for user: ${dto.userId}`);

    // Check if user already has a pending/in-progress verification
    const existingKyc = await this.kycRepository.findOne({
      where: {
        userId: dto.userId,
        status: KycStatus.IN_PROGRESS,
      },
    });

    if (existingKyc) {
      throw new ConflictException(
        'User already has a KYC verification in progress',
      );
    }

    // Check if user is already verified
    const verifiedKyc = await this.kycRepository.findOne({
      where: {
        userId: dto.userId,
        status: KycStatus.APPROVED,
      },
    });

    if (verifiedKyc && !this.isKycExpired(verifiedKyc)) {
      throw new ConflictException('User is already verified');
    }

    try {
      // Create verification with external provider
      const providerResponse =
        await this.kycProviderService.createVerification({
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phoneNumber: dto.phoneNumber,
          dateOfBirth: dto.dateOfBirth,
          country: dto.country,
          level: dto.level || KycLevel.BASIC,
          userId: dto.userId,
          metadata: dto.metadata,
        });

      // Create KYC record in database
      const kyc = this.kycRepository.create({
        userId: dto.userId,
        verificationId: providerResponse.verificationId,
        verificationUrl: providerResponse.verificationUrl,
        status: KycStatus.PENDING,
        level: dto.level || KycLevel.BASIC,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        country: dto.country,
        provider: this.kycProviderService.getProviderName(),
        submittedAt: new Date(),
        expiresAt: providerResponse.expiresAt,
        metadata: dto.metadata,
        attemptCount: 1,
      });

      const savedKyc = await this.kycRepository.save(kyc);

      // Emit event
      this.eventEmitter.emit('kyc.initiated', {
        kycId: savedKyc.id,
        userId: savedKyc.userId,
        verificationId: savedKyc.verificationId,
      });

      this.logger.log(`KYC initiated successfully: ${savedKyc.id}`);

      return savedKyc;
    } catch (error) {
      this.logger.error(`Failed to initiate KYC: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get KYC status by user ID
   */
  async getKycByUserId(userId: string): Promise<KycVerification> {
    const kyc = await this.kycRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (!kyc) {
      throw new NotFoundException('KYC verification not found for user');
    }

    return kyc;
  }

  /**
   * Get KYC status by verification ID
   */
  async getKycByVerificationId(
    verificationId: string,
  ): Promise<KycVerification> {
    const kyc = await this.kycRepository.findOne({
      where: { verificationId },
    });

    if (!kyc) {
      throw new NotFoundException('KYC verification not found');
    }

    return kyc;
  }

  /**
   * Get KYC by ID
   */
  async getKycById(id: string): Promise<KycVerification> {
    const kyc = await this.kycRepository.findOne({ where: { id } });

    if (!kyc) {
      throw new NotFoundException('KYC verification not found');
    }

    return kyc;
  }

  /**
   * Update KYC information
   */
  async updateKyc(
    id: string,
    dto: UpdateKycDto,
  ): Promise<KycVerification> {
    const kyc = await this.getKycById(id);

    if (kyc.status === KycStatus.APPROVED) {
      throw new BadRequestException('Cannot update approved KYC verification');
    }

    Object.assign(kyc, dto);
    return this.kycRepository.save(kyc);
  }

  /**
   * Handle webhook from KYC provider
   */
  async handleWebhook(
    verificationId: string,
    status: KycStatus,
    data: any,
  ): Promise<KycVerification> {
    this.logger.log(`Processing webhook for verification: ${verificationId}`);

    const kyc = await this.getKycByVerificationId(verificationId);

    const oldStatus = kyc.status;
    kyc.status = status;

    // Update additional fields based on webhook data
    if (data.rejectionReason) {
      kyc.rejectionReason = data.rejectionReason;
    }

    if (data.riskAssessment) {
      kyc.riskAssessment = data.riskAssessment;
    }

    if (data.metadata) {
      kyc.metadata = { ...kyc.metadata, ...data.metadata };
    }

    // Set completion timestamp
    if (
      status === KycStatus.APPROVED ||
      status === KycStatus.REJECTED
    ) {
      kyc.completedAt = new Date();
    }

    // Check if requires manual review
    if (data.riskAssessment?.riskLevel === 'high' || data.requiresReview) {
      kyc.status = KycStatus.REQUIRES_REVIEW;
      kyc.isManualReview = true;
    }

    const updatedKyc = await this.kycRepository.save(kyc);

    // Emit status change event
    this.eventEmitter.emit('kyc.status.changed', {
      kycId: updatedKyc.id,
      userId: updatedKyc.userId,
      oldStatus,
      newStatus: status,
      verificationId,
    });

    // Emit specific events based on status
    if (status === KycStatus.APPROVED) {
      this.eventEmitter.emit('kyc.approved', {
        kycId: updatedKyc.id,
        userId: updatedKyc.userId,
        level: updatedKyc.level,
      });
    } else if (status === KycStatus.REJECTED) {
      this.eventEmitter.emit('kyc.rejected', {
        kycId: updatedKyc.id,
        userId: updatedKyc.userId,
        reason: updatedKyc.rejectionReason,
      });
    }

    this.logger.log(
      `Webhook processed: ${verificationId} - Status: ${status}`,
    );

    return updatedKyc;
  }

  /**
   * Manual review by admin
   */
  async manualReview(
    id: string,
    dto: ManualReviewDto,
  ): Promise<KycVerification> {
    const kyc = await this.getKycById(id);

    if (!kyc.isManualReview) {
      throw new BadRequestException(
        'This verification does not require manual review',
      );
    }

    kyc.status = dto.status;
    kyc.reviewedBy = dto.reviewedBy;
    kyc.reviewNotes = dto.reviewNotes;
    kyc.completedAt = new Date();
    kyc.isManualReview = false;

    const updatedKyc = await this.kycRepository.save(kyc);

    this.eventEmitter.emit('kyc.manually.reviewed', {
      kycId: updatedKyc.id,
      userId: updatedKyc.userId,
      status: dto.status,
      reviewedBy: dto.reviewedBy,
    });

    return updatedKyc;
  }

  /**
   * Retry failed KYC
   */
  async retryKyc(id: string): Promise<KycVerification> {
    const kyc = await this.getKycById(id);

    if (
      kyc.status !== KycStatus.REJECTED &&
      kyc.status !== KycStatus.EXPIRED
    ) {
      throw new BadRequestException('Can only retry rejected or expired KYC');
    }

    if (kyc.attemptCount >= 3) {
      throw new BadRequestException('Maximum retry attempts reached');
    }

    // Create new verification with provider
    const providerResponse =
      await this.kycProviderService.createVerification({
        firstName: kyc.firstName,
        lastName: kyc.lastName,
        email: kyc.email,
        phoneNumber: kyc.phoneNumber,
        dateOfBirth: kyc.dateOfBirth?.toISOString(),
        country: kyc.country,
        level: kyc.level,
        userId: kyc.userId,
        metadata: kyc.metadata,
      });

    kyc.verificationId = providerResponse.verificationId;
    kyc.verificationUrl = providerResponse.verificationUrl;
    kyc.status = KycStatus.PENDING;
    kyc.submittedAt = new Date();
    kyc.attemptCount += 1;
    kyc.expiresAt = providerResponse.expiresAt;
    kyc.completedAt = null;
    kyc.rejectionReason = null;

    return this.kycRepository.save(kyc);
  }

  /**
   * Query KYC verifications with filters
   */
  async queryKyc(dto: QueryKycDto) {
    const { status, level, userId, page = 1, limit = 20 } = dto;

    const query = this.kycRepository.createQueryBuilder('kyc');

    if (status) {
      query.andWhere('kyc.status = :status', { status });
    }

    if (level) {
      query.andWhere('kyc.level = :level', { level });
    }

    if (userId) {
      query.andWhere('kyc.userId = :userId', { userId });
    }

    query
      .orderBy('kyc.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [verifications, total] = await query.getManyAndCount();

    return {
      data: verifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check if user is verified
   */
  async isUserVerified(
    userId: string,
    requiredLevel?: KycLevel,
  ): Promise<boolean> {
    const kyc = await this.kycRepository.findOne({
      where: {
        userId,
        status: KycStatus.APPROVED,
      },
      order: { completedAt: 'DESC' },
    });

    if (!kyc) {
      return false;
    }

    // Check if KYC is expired
    if (this.isKycExpired(kyc)) {
      return false;
    }

    // Check if KYC level meets requirement
    if (requiredLevel) {
      const levels = [KycLevel.BASIC, KycLevel.INTERMEDIATE, KycLevel.ADVANCED];
      const kycLevelIndex = levels.indexOf(kyc.level);
      const requiredLevelIndex = levels.indexOf(requiredLevel);

      return kycLevelIndex >= requiredLevelIndex;
    }

    return true;
  }

  /**
   * Get user verification level
   */
  async getUserVerificationLevel(userId: string): Promise<KycLevel | null> {
    const kyc = await this.kycRepository.findOne({
      where: {
        userId,
        status: KycStatus.APPROVED,
      },
      order: { completedAt: 'DESC' },
    });

    return kyc && !this.isKycExpired(kyc) ? kyc.level : null;
  }

  /**
   * Check if KYC is expired
   */
  private isKycExpired(kyc: KycVerification): boolean {
    if (!kyc.expiresAt) {
      return false;
    }

    return new Date() > kyc.expiresAt;
  }

  /**
   * Get pending manual reviews
   */
  async getPendingReviews(page = 1, limit = 20) {
    const [verifications, total] = await this.kycRepository.findAndCount({
      where: {
        status: KycStatus.REQUIRES_REVIEW,
        isManualReview: true,
      },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: verifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get KYC statistics
   */
  async getStatistics() {
    const [
      totalVerifications,
      pendingCount,
      approvedCount,
      rejectedCount,
      requiresReviewCount,
    ] = await Promise.all([
      this.kycRepository.count(),
      this.kycRepository.count({ where: { status: KycStatus.PENDING } }),
      this.kycRepository.count({ where: { status: KycStatus.APPROVED } }),
      this.kycRepository.count({ where: { status: KycStatus.REJECTED } }),
      this.kycRepository.count({
        where: { status: KycStatus.REQUIRES_REVIEW },
      }),
    ]);

    return {
      total: totalVerifications,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      requiresReview: requiresReviewCount,
    };
  }
}