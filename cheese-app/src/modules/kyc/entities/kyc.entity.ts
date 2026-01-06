import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum KycStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  REQUIRES_REVIEW = 'requires_review',
}

export enum KycLevel {
  BASIC = 'basic', // Basic identity verification
  INTERMEDIATE = 'intermediate', // + Address verification
  ADVANCED = 'advanced', // + Enhanced due diligence
}

@Entity('kyc_verifications')
export class KycVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  verificationId: string; // External KYC provider's verification ID

  @Column({
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING,
  })
  status: KycStatus;

  @Column({
    type: 'enum',
    enum: KycLevel,
    default: KycLevel.BASIC,
  })
  level: KycLevel;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  verificationUrl: string; // URL to redirect user for KYC

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phoneNumber: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nationality: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  documentType: string; // passport, drivers_license, national_id

  @Column({ type: 'varchar', length: 100, nullable: true })
  documentNumber: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postalCode: string;

  @Column({ type: 'varchar', length: 3, nullable: true })
  country: string; // ISO 3166-1 alpha-3 country code

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Additional data from KYC provider

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'jsonb', nullable: true })
  riskAssessment: {
    riskLevel: 'low' | 'medium' | 'high';
    score: number;
    flags: string[];
  };

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provider: string; // KYC provider name (e.g., 'onfido', 'sumsub', 'veriff')

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @Column({ type: 'boolean', default: false })
  isManualReview: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reviewedBy: string; // Admin user who reviewed

  @Column({ type: 'text', nullable: true })
  reviewNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}