// src/banks/entities/bank-deposit.entity.ts
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

export enum BankDepositStatus {
  PENDING   = 'pending',
  COMPLETED = 'completed',
  FAILED    = 'failed',
}

@Entity('bank_deposits')
export class BankDeposit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  // PulseMFB reference for this inbound credit — unique so we never double-credit
  @Column({ unique: true })
  reference: string;

  @Column({ name: 'virtual_account_number' })
  virtualAccountNumber: string;

  @Column({ name: 'amount_ngn', type: 'decimal', precision: 20, scale: 2 })
  amountNgn: string;

  @Column({ name: 'amount_usdc', type: 'decimal', precision: 20, scale: 6 })
  amountUsdc: string;

  @Column({ name: 'rate_applied', type: 'decimal', precision: 12, scale: 4 })
  rateApplied: string;

  @Column({ name: 'sender_name', type: 'varchar', nullable: true })
  senderName: string | null;

  @Column({ name: 'sender_account_number', type: 'varchar', nullable: true })
  senderAccountNumber: string | null;

  @Column({ type: 'varchar', default: BankDepositStatus.PENDING })
  status: BankDepositStatus;

  @Column({ name: 'tx_hash', type: 'varchar', nullable: true })
  txHash: string | null;

  @Column({ name: 'failure_reason', type: 'varchar', nullable: true })
  failureReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
