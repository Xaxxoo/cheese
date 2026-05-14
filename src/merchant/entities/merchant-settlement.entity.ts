import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Merchant } from './merchant.entity';

export enum MerchantSettlementStatus {
  QUEUED = 'queued',
  SETTLING = 'settling',
  SETTLED = 'settled',
  FAILED = 'failed',
}

@Entity('merchant_settlements')
export class MerchantSettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({ name: 'payment_id', type: 'varchar', nullable: true })
  paymentId: string | null;

  @Column({ name: 'payout_account_id', type: 'varchar', nullable: true })
  payoutAccountId: string | null;

  @Column({ name: 'payment_reference' })
  paymentReference: string;

  @Column({ type: 'varchar' })
  currency: string;

  @Column({ name: 'gross_amount', type: 'decimal', precision: 20, scale: 2 })
  grossAmount: number;

  @Column({ name: 'net_amount', type: 'decimal', precision: 20, scale: 2 })
  netAmount: number;

  @Column({ type: 'varchar' })
  destination: string;

  @Column({ type: 'varchar', default: 'instant' })
  schedule: string;

  @Column({ name: 'eta', type: 'timestamp', nullable: true })
  eta: Date | null;

  @Column({ name: 'status', type: 'varchar', default: MerchantSettlementStatus.QUEUED })
  status: MerchantSettlementStatus;

  @Column({ name: 'bank_reference', type: 'varchar', nullable: true })
  bankReference: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
