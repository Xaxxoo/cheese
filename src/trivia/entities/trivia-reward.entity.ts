import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TriviaRewardStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('trivia_rewards')
@Index('uq_trivia_rewards_week_start', ['weekStart'], { unique: true })
export class TriviaReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  @Column({ name: 'winner_id', type: 'uuid' })
  winnerId: string;

  @Column({ name: 'total_score', type: 'int' })
  totalScore: number;

  @Column({ name: 'amount_usdc', type: 'decimal', precision: 20, scale: 6, default: 2 })
  amountUsdc: string;

  @Column({ type: 'varchar', unique: true })
  reference: string;

  @Column({ type: 'varchar', nullable: true })
  txHash: string | null;

  @Column({ type: 'varchar', default: TriviaRewardStatus.PENDING })
  status: TriviaRewardStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt: Date | null;

  @Column({ name: 'failure_reason', type: 'varchar', nullable: true })
  failureReason: string | null;

  @Column({ name: 'rewarded_at', type: 'timestamptz', nullable: true })
  rewardedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
