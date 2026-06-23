// src/private-gateway/entities/private-invoice.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PrivateInvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SETTLING = 'settling',
  SETTLED = 'settled',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

@Entity('private_invoices')
@Index('UQ_private_invoices_reference', ['reference'], { unique: true })
@Index('IDX_private_invoices_status_expires', ['status', 'expiresAt'])
export class PrivateInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // PI-XXXXXXXXXXXXXXXX — 19 chars, fits in Stellar's 28-byte text memo
  @Column({ type: 'varchar', length: 20 })
  reference: string;

  @Column({ type: 'varchar' })
  merchantId: string;

  @Column({ type: 'varchar' })
  merchantName: string;

  @Column({ type: 'decimal', precision: 20, scale: 6 })
  amountUsdc: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: true, default: null })
  amountNgn: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true, default: null })
  rateApplied: string | null;

  @Column({ type: 'varchar', default: PrivateInvoiceStatus.PENDING })
  status: PrivateInvoiceStatus;

  @Column({ type: 'varchar' })
  settlementBankCode: string;

  @Column({ type: 'varchar' })
  settlementAccountNumber: string;

  @Column({ type: 'varchar' })
  settlementAccountName: string;

  @Column({ type: 'varchar' })
  settlementBankName: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  callbackUrl: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  stellarTxHash: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  settlementReference: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  failureReason: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  paidAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  settledAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
