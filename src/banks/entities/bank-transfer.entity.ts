// src/banks/entities/bank-transfer.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum BankTransferStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

@Entity('bank_transfers')
export class BankTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'account_number' })
  accountNumber: string;

  @Column({ name: 'bank_code' })
  bankCode: string;

  @Column({ name: 'bank_name' })
  bankName: string;

  @Column({ name: 'account_name' })
  accountName: string;

  @Column({ name: 'amount_ngn', type: 'decimal', precision: 20, scale: 2 })
  amountNgn: string;

  @Column({ name: 'amount_usdc', type: 'decimal', precision: 20, scale: 6 })
  amountUsdc: string;

  @Column({
    name: 'fee_usdc',
    type: 'decimal',
    precision: 20,
    scale: 6,
    default: 0,
  })
  feeUsdc: string;

  @Column({ name: 'rate_applied', type: 'decimal', precision: 12, scale: 4 })
  rateApplied: string;

  @Column({
    type: 'varchar',
    default: BankTransferStatus.PENDING,
  })
  status: BankTransferStatus;

  @Column({ unique: true })
  reference: string;

  // Provider transfer reference (PulseMFB)
  @Column({ name: 'provider_reference', type: 'varchar', nullable: true })
  providerReference: string | null;

  @Column({ name: 'failure_reason', type: 'varchar', nullable: true })
  failureReason: string | null;

  // ── Split-debit fields (EVM + Stellar) ──────────────────────────────────
  @Column({ name: 'evm_wallet_address', type: 'varchar', nullable: true })
  evmWalletAddress: string | null;

  @Column({ name: 'evm_chain_id', type: 'int', nullable: true })
  evmChainId: number | null;

  @Column({ name: 'evm_amount', type: 'varchar', nullable: true })
  evmAmount: string | null;

  @Column({ name: 'stellar_amount', type: 'varchar', nullable: true })
  stellarAmount: string | null;

  @Column({ name: 'evm_tx_hash', type: 'varchar', nullable: true })
  evmTxHash: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
