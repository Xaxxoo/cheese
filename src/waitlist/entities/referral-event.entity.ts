import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { WaitlistEntry } from './waitlist-entry.entity';

export const REFERRAL_POINTS = 20;

export enum ReferrerType {
  USER = 'user',
  WAITLIST = 'waitlist',
}

@Entity('referral_events')
export class ReferralEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'referrer_user_id', type: 'varchar', nullable: true })
  referrerUserId: string | null;

  @Column({ name: 'referrer_waitlist_id', type: 'varchar', nullable: true })
  referrerWaitlistId: string | null;

  @Column({ name: 'referred_user_id', type: 'varchar', nullable: true })
  referredUserId: string | null;

  @Column({ name: 'referred_waitlist_id', type: 'varchar', nullable: true })
  referredWaitlistId: string | null;

  @Column({ name: 'referred_type', type: 'varchar', default: 'waitlist' })
  referredType: 'user' | 'waitlist';

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'referrer_user_id' })
  referrerUser?: User;

  @ManyToOne(() => WaitlistEntry, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'referrer_waitlist_id' })
  referrerWaitlist?: WaitlistEntry;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'referred_user_id' })
  referredUser?: User;

  @ManyToOne(() => WaitlistEntry, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'referred_waitlist_id' })
  referredWaitlist?: WaitlistEntry;

  @Column({ type: 'int', default: 20, name: 'points_awarded' })
  pointsAwarded: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
