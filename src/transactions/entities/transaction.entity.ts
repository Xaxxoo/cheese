// src/transactions/entities/transaction.entity.ts
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

export enum TxType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  SEND_USERNAME = 'send_username',
  SEND_ADDRESS = 'send_address',
  BANK_TRANSFER = 'bank_transfer',
  YIELD_CREDIT = 'yield_credit',
  REFERRAL_BONUS = 'referral_bonus',
  CARD_PAYMENT = 'card_payment',
  FEE = 'fee',
  PAY_REQUEST = 'pay_request', // payment via PayLink
  BILL_PAYMENT = 'bill_payment',
  TRIVIA_REWARD = 'trivia_reward',
}

export enum TxStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar' })
  type: TxType;

  @Column({ type: 'varchar', default: TxStatus.PENDING })
  status: TxStatus;

  // Amount in USDC — stored as string to preserve decimals
  @Column({ name: 'amount_usdc', type: 'decimal', precision: 20, scale: 6 })
  amountUsdc: string;

  // NGN equivalent at time of transaction
  @Column({
    name: 'amount_ngn',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  amountNgn: string | null;

  @Column({
    name: 'fee_usdc',
    type: 'decimal',
    precision: 20,
    scale: 6,
    default: 0,
  })
  feeUsdc: string;

  @Column({
    name: 'rate_applied',
    type: 'decimal',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  rateApplied: string | null;

  // Send / Receive party
  @Column({ name: 'recipient_username', type: 'varchar', nullable: true })
  recipientUsername: string | null;

  @Column({ name: 'recipient_address', type: 'varchar', nullable: true })
  recipientAddress: string | null;

  @Column({ name: 'recipient_name', type: 'varchar', nullable: true })
  recipientName: string | null;

  @Column({ name: 'bank_name', type: 'varchar', nullable: true })
  bankName: string | null;

  @Column({ name: 'account_number', type: 'varchar', nullable: true })
  accountNumber: string | null;

  // Stellar on-chain
  // Uniqueness is enforced at the DB level as a per-user composite index
  // (user_id, tx_hash) — see migration PerUserTxHashUnique1600000000012.
  @Column({ name: 'tx_hash', type: 'varchar', nullable: true })
  txHash: string | null;

  @Column({ type: 'varchar', nullable: true })
  network: string | null;

  @Column({ type: 'varchar', unique: true })
  reference: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ name: 'failure_reason', type: 'varchar', nullable: true })
  failureReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (u) => u.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
