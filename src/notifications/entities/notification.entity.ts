// src/notifications/entities/notification.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum NotificationType {
  MONEY = 'money',
  SECURITY = 'security',
  SYSTEM = 'system',
  KYC_VERIFIED = 'kyc_verified',
  REFERRAL_JOINED = 'referral_joined',
  POINTS_AWARDED = 'points_awarded',
  MILESTONE_REACHED = 'milestone_reached',
  LAUNCH_ANNOUNCEMENT = 'launch_announcement',
  LEADERBOARD_UPDATE = 'leaderboard_update',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'varchar',
    default: NotificationType.SYSTEM,
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: false })
  read: boolean;

  @Column({ name: 'deep_link', type: 'varchar', nullable: true })
  deepLink: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
