import { Test, TestingModule } from '@nestjs/testing';
import { KycService } from '../services/kyc.service';
import { KycProviderService } from '../services/kyc-provider.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KycVerification, KycStatus, KycLevel } from '../entities/kyc.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('KycService', () => {
  let service: KycService;
  let providerService: KycProviderService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockProviderService = {
    createVerification: jest.fn(),
    getVerificationStatus: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    getProviderName: jest.fn().mockReturnValue('onfido'),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        {
          provide: getRepositoryToken(KycVerification),
          useValue: mockRepository,
        },
        {
          provide: KycProviderService,
          useValue: mockProviderService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
    providerService = module.get<KycProviderService>(KycProviderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateKyc', () => {
    it('should initiate KYC successfully', async () => {
      const dto = {
        userId: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        level: KycLevel.BASIC,
      };

      const providerResponse = {
        verificationId: 'ver-123',
        verificationUrl: 'https://provider.com/verify/xxx',
        status: 'pending',
      };

      const savedKyc = {
        id: 'kyc-123',
        ...dto,
        verificationId: providerResponse.verificationId,
        verificationUrl: providerResponse.verificationUrl,
        status: KycStatus.PENDING,
        provider: 'onfido',
        attemptCount: 1,
      };

      mockRepository.findOne.mockResolvedValueOnce(null); // No existing KYC
      mockProviderService.createVerification.mockResolvedValueOnce(
        providerResponse,
      );
      mockRepository.create.mockReturnValueOnce(savedKyc);
      mockRepository.save.mockResolvedValueOnce(savedKyc);

      const result = await service.initiateKyc(dto);

      expect(result).toEqual(savedKyc);
      expect(mockProviderService.createVerification).toHaveBeenCalledWith({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        level: dto.level,
        userId: dto.userId,
        phoneNumber: undefined,
        dateOfBirth: undefined,
        country: undefined,
        metadata: undefined,
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('kyc.initiated', {
        kycId: savedKyc.id,
        userId: savedKyc.userId,
        verificationId: savedKyc.verificationId,
      });
    });

    it('should throw error if user already has KYC in progress', async () => {
      const dto = {
        userId: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        level: KycLevel.BASIC,
      };

      mockRepository.findOne.mockResolvedValueOnce({
        status: KycStatus.IN_PROGRESS,
      });

      await expect(service.initiateKyc(dto)).rejects.toThrow(
        'User already has a KYC verification in progress',
      );
    });
  });

  describe('handleWebhook', () => {
    it('should update KYC status from webhook', async () => {
      const verificationId = 'ver-123';
      const existingKyc = {
        id: 'kyc-123',
        userId: 'user-123',
        verificationId,
        status: KycStatus.PENDING,
      };

      const updatedKyc = {
        ...existingKyc,
        status: KycStatus.APPROVED,
        completedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValueOnce(existingKyc);
      mockRepository.save.mockResolvedValueOnce(updatedKyc);

      const result = await service.handleWebhook(
        verificationId,
        KycStatus.APPROVED,
        {},
      );

      expect(result.status).toBe(KycStatus.APPROVED);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'kyc.status.changed',
        expect.any(Object),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'kyc.approved',
        expect.any(Object),
      );
    });

    it('should set manual review if high risk', async () => {
      const verificationId = 'ver-123';
      const existingKyc = {
        id: 'kyc-123',
        userId: 'user-123',
        verificationId,
        status: KycStatus.PENDING,
      };

      mockRepository.findOne.mockResolvedValueOnce(existingKyc);
      mockRepository.save.mockResolvedValueOnce({
        ...existingKyc,
        status: KycStatus.REQUIRES_REVIEW,
        isManualReview: true,
      });

      const result = await service.handleWebhook(
        verificationId,
        KycStatus.IN_PROGRESS,
        {
          riskAssessment: {
            riskLevel: 'high',
            score: 85,
            flags: ['suspicious_document'],
          },
        },
      );

      expect(result.status).toBe(KycStatus.REQUIRES_REVIEW);
      expect(result.isManualReview).toBe(true);
    });
  });

  describe('isUserVerified', () => {
    it('should return true for verified user', async () => {
      const userId = 'user-123';
      const verifiedKyc = {
        id: 'kyc-123',
        userId,
        status: KycStatus.APPROVED,
        level: KycLevel.BASIC,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      mockRepository.findOne.mockResolvedValueOnce(verifiedKyc);

      const result = await service.isUserVerified(userId);

      expect(result).toBe(true);
    });

    it('should return false for expired KYC', async () => {
      const userId = 'user-123';
      const expiredKyc = {
        id: 'kyc-123',
        userId,
        status: KycStatus.APPROVED,
        level: KycLevel.BASIC,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      mockRepository.findOne.mockResolvedValueOnce(expiredKyc);

      const result = await service.isUserVerified(userId);

      expect(result).toBe(false);
    });

    it('should check KYC level requirement', async () => {
      const userId = 'user-123';
      const basicKyc = {
        id: 'kyc-123',
        userId,
        status: KycStatus.APPROVED,
        level: KycLevel.BASIC,
        completedAt: new Date(),
        expiresAt: null,
      };

      mockRepository.findOne.mockResolvedValueOnce(basicKyc);

      const resultBasic = await service.isUserVerified(
        userId,
        KycLevel.BASIC,
      );
      expect(resultBasic).toBe(true);

      mockRepository.findOne.mockResolvedValueOnce(basicKyc);
      const resultIntermediate = await service.isUserVerified(
        userId,
        KycLevel.INTERMEDIATE,
      );
      expect(resultIntermediate).toBe(false);
    });
  });

  describe('retryKyc', () => {
    it('should retry rejected KYC', async () => {
      const rejectedKyc = {
        id: 'kyc-123',
        userId: 'user-123',
        status: KycStatus.REJECTED,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        level: KycLevel.BASIC,
        attemptCount: 1,
      };

      const providerResponse = {
        verificationId: 'ver-456',
        verificationUrl: 'https://provider.com/verify/yyy',
        status: 'pending',
      };

      mockRepository.findOne.mockResolvedValueOnce(rejectedKyc);
      mockProviderService.createVerification.mockResolvedValueOnce(
        providerResponse,
      );
      mockRepository.save.mockResolvedValueOnce({
        ...rejectedKyc,
        verificationId: providerResponse.verificationId,
        status: KycStatus.PENDING,
        attemptCount: 2,
      });

      const result = await service.retryKyc(rejectedKyc.id);

      expect(result.status).toBe(KycStatus.PENDING);
      expect(result.attemptCount).toBe(2);
      expect(result.verificationId).toBe(providerResponse.verificationId);
    });

    it('should throw error if max attempts reached', async () => {
      const kyc = {
        id: 'kyc-123',
        status: KycStatus.REJECTED,
        attemptCount: 3,
      };

      mockRepository.findOne.mockResolvedValueOnce(kyc);

      await expect(service.retryKyc(kyc.id)).rejects.toThrow(
        'Maximum retry attempts reached',
      );
    });
  });

  describe('queryKyc', () => {
    it('should query KYC verifications with filters', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            { id: 'kyc-1', status: KycStatus.PENDING },
            { id: 'kyc-2', status: KycStatus.PENDING },
          ],
          2,
        ]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.queryKyc({
        status: KycStatus.PENDING,
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('should return KYC statistics', async () => {
      mockRepository.count
        .mockResolvedValueOnce(1000) // total
        .mockResolvedValueOnce(50) // pending
        .mockResolvedValueOnce(800) // approved
        .mockResolvedValueOnce(100) // rejected
        .mockResolvedValueOnce(50); // requires review

      const stats = await service.getStatistics();

      expect(stats).toEqual({
        total: 1000,
        pending: 50,
        approved: 800,
        rejected: 100,
        requiresReview: 50,
      });
    });
  });
});

describe('KycController (Integration)', () => {
  // Add integration tests here
  it('should expose all required endpoints', () => {
    // Test endpoint availability
  });
});