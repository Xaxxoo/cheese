// src/kyc/entities/kyc-attempt.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum KycAttemptType {
  BVN = 'bvn',
  NIN = 'nin',
  SELFIE = 'selfie',
  DOCUMENT = 'document',
}

export enum KycAttemptStatus {
  VERIFIED = 'verified',
  FAILED = 'failed',
}

@Entity('kyc_attempts')
@Index('idx_kyc_attempts_user_id', ['userId'])
export class KycAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar' })
  type: KycAttemptType;

  @Column({ type: 'varchar' })
  status: KycAttemptStatus;

  @Column({ type: 'varchar', default: 'dojah' })
  provider: string;

  /** Last 4 digits of the BVN/NIN — never store the full number */
  @Column({ name: 'document_suffix', type: 'varchar', nullable: true })
  documentSuffix: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  /** Full Dojah response stored for audit — PII scrubbed in service before save */
  @Column({ name: 'raw_response', type: 'jsonb', nullable: true })
  rawResponse: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
