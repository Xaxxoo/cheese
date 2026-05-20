// src/auth/entities/user.entity.ts
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Device } from '../../devices/entities/device.entity';
import { RefreshToken } from './refresh-token.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { ShareEvent } from '../../waitlist/entities/share-event.entity';
import {
  normalizeEmail,
  normalizeUsername,
} from '../utils/identity-normalization.util';

export enum KycStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum Tier {
  SILVER = 'silver',
  GOLD = 'gold',
  BLACK = 'black',
}

export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  OPERATOR = 'operator',
  TREASURER = 'treasurer',
  SUPPORT = 'support',
}

export enum WalletStatus {
  PENDING = 'pending', // creation in progress / retry job running
  ACTIVE = 'active', // wallet exists and is ready
  FAILED = 'failed', // all retry attempts exhausted — needs manual fix
}

@Entity('users')
@Index('idx_user_email', ['email'])
@Index('idx_user_username', ['username'])
@Index('idx_user_points', ['points'])
@Index('idx_user_points_created', ['points', 'createdAt'])
@Index('idx_user_stellar_public_key', ['stellarPublicKey'])
@Index('idx_user_evm_address', ['evmAddress'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true, nullable: true, type: 'varchar' })
  phone: string | null;

  @Column({ unique: true })
  username: string;

  @Column({ name: 'full_name', nullable: true, type: 'varchar' })
  fullName: string | null;

  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Exclude()
  @Column({ name: 'pin_hash', type: 'varchar', nullable: true })
  pinHash: string | null;

  @Column({ name: 'kyc_status', type: 'varchar', default: KycStatus.PENDING })
  kycStatus: KycStatus;

  @Column({ type: 'varchar', default: Tier.SILVER })
  tier: Tier;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'phone_verified', default: false })
  phoneVerified: boolean;

  // ── Waitlist / Referral ──────────────────────────────────────────────────
  @Column({
    name: 'referral_code',
    type: 'varchar',
    length: 20,
    nullable: true,
    unique: true,
  })
  referralCode: string | null;

  // Stored as plain varchar — referrer may be a waitlist entry or a full user
  @Column({ name: 'referred_by', type: 'varchar', nullable: true })
  referredBy: string | null;

  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({ name: 'is_flagged', default: false })
  isFlagged: boolean;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  // ── Stellar custodial wallet ─────────────────────────────────────────────
  @Column({
    name: 'stellar_public_key',
    type: 'varchar',
    nullable: true,
    unique: true,
  })
  stellarPublicKey: string | null;

  @Exclude()
  @Column({ name: 'stellar_secret_enc', type: 'text', nullable: true })
  stellarSecretEnc: string | null;

  @Column({
    name: 'stellar_wallet_status',
    type: 'varchar',
    default: WalletStatus.PENDING,
  })
  stellarWalletStatus: WalletStatus;

  // Cursor for incremental Horizon deposit polling (stores the paging_token of the last seen payment)
  @Column({ name: 'stellar_deposit_cursor', type: 'varchar', nullable: true })
  stellarDepositCursor: string | null;

  // ── EVM wallet ───────────────────────────────────────────────────────────
  @Column({
    name: 'evm_address',
    type: 'varchar',
    nullable: true,
    unique: true,
  })
  evmAddress: string | null;

  @Column({
    name: 'evm_wallet_status',
    type: 'varchar',
    default: WalletStatus.PENDING,
  })
  evmWalletStatus: WalletStatus;

  // ── Tier upgrade eligibility ─────────────────────────────────────────────
  /** Set when user first hits the Silver→Gold transaction milestone. Used to avoid repeat emails. */
  @Column({ name: 'gold_eligible_at', type: 'timestamp', nullable: true })
  goldEligibleAt: Date | null;

  /** Set when user first hits the Gold→Black transaction milestone. Used to avoid repeat emails. */
  @Column({ name: 'black_eligible_at', type: 'timestamp', nullable: true })
  blackEligibleAt: Date | null;

  /** True while document is submitted and awaiting admin approval for Black tier. */
  @Column({ name: 'pending_black_approval', default: false })
  pendingBlackApproval: boolean;

  // ── Admin access ─────────────────────────────────────────────────────────
  @Column({ name: 'is_admin', default: false })
  isAdmin: boolean;

  @Column({ name: 'admin_role', type: 'varchar', nullable: true })
  adminRole: AdminRole | null;

  @Column({ name: 'must_change_password', default: false })
  mustChangePassword: boolean;

  // ── Timestamps ───────────────────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ── Relations ────────────────────────────────────────────────────────────
  @OneToMany(() => Device, (d) => d.user, { cascade: true })
  devices: Device[];

  @OneToMany(() => RefreshToken, (rt) => rt.user, { cascade: true })
  refreshTokens: RefreshToken[];

  @OneToMany(() => Transaction, (tx) => tx.user)
  transactions: Transaction[];

  @OneToMany(() => ShareEvent, (share) => share.user)
  shareEvents: ShareEvent[];

  @BeforeInsert()
  @BeforeUpdate()
  normalizeIdentityFields(): void {
    this.email = normalizeEmail(this.email);
    this.username = normalizeUsername(this.username);
  }
}
