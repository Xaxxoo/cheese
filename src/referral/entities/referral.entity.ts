// src/referral/entities/referral.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum ReferralStatus {
  PENDING = 'pending', // referree signed up but not KYC verified
  QUALIFIED = 'qualified', // referree completed first transaction
  REWARDED = 'rewarded', // reward credited to referrer
}

@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'referrer_id' })
  referrerId: string;

  @Column({ name: 'referee_id', unique: true })
  refereeId: string;

  @Column({
    type: 'varchar',
    default: ReferralStatus.PENDING,
  })
  status: ReferralStatus;

  // Reward amount in USDC credited to referrer
  @Column({
    name: 'reward_usdc',
    type: 'decimal',
    precision: 20,
    scale: 6,
    nullable: true,
  })
  rewardUsdc: string | null;

  @Column({ name: 'rewarded_at', type: 'integer', transformer: {
    from: (value: number) => value ? new Date(value) : null,
    to: (value: Date) => value ? value.getTime() : null,
  }, nullable: true })
  rewardedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referee_id' })
  referee: User;
}
