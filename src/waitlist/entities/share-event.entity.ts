import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { WaitlistEntry } from './waitlist-entry.entity';

export enum SharePlatform {
  TWITTER  = 'twitter',
  LINKEDIN = 'linkedin',
  WHATSAPP = 'whatsapp',
  TELEGRAM = 'telegram',
  FACEBOOK = 'facebook',
}

export const PLATFORM_POINTS: Record<SharePlatform, number> = {
  [SharePlatform.TWITTER]:  10,
  [SharePlatform.LINKEDIN]: 8,
  [SharePlatform.FACEBOOK]: 6,
  [SharePlatform.WHATSAPP]: 5,
  [SharePlatform.TELEGRAM]: 5,
};

export enum SharerType {
  USER = 'user',
  WAITLIST = 'waitlist',
}

@Entity('share_events')
export class ShareEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ name: 'waitlist_id', nullable: true })
  waitlistId: string | null;

  @Column({ name: 'sharer_type', type: 'varchar', default: 'waitlist' })
  sharerType: 'user' | 'waitlist';

  @ManyToOne(() => User, (user) => user.shareEvents, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => WaitlistEntry, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'waitlist_id' })
  waitlistEntry?: WaitlistEntry;

  // postgres doesn't support enum types, so use varchar in development
  @Column({ type: 'varchar', length: 20 })
  platform: SharePlatform;

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ type: 'int', default: 0, name: 'points_awarded' })
  pointsAwarded: number;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'ip_address' })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_fraud' })
  isFraud: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}