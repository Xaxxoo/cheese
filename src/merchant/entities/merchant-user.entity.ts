import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Merchant } from './merchant.entity';
import { MerchantRefreshToken } from './merchant-refresh-token.entity';

export enum MerchantRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  FINANCE = 'finance',
  OPS = 'ops',
  SUPPORT = 'support',
  DEVELOPER = 'developer',
}

@Entity('merchant_users')
export class MerchantUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @ManyToOne(() => Merchant, (m) => m.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', default: MerchantRole.OWNER })
  role: MerchantRole;

  @Column({ type: 'simple-array', default: '' })
  permissions: string[];

  @Column({ name: 'two_factor_enabled', default: false })
  twoFactorEnabled: boolean;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => MerchantRefreshToken, (rt) => rt.merchantUser, { cascade: true })
  refreshTokens: MerchantRefreshToken[];
}
