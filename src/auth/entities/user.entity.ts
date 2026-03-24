// src/auth/entities/user.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Device } from '../../devices/entities/device.entity';
import { RefreshToken } from './refresh-token.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { ShareEvent } from '../../waitlist/entities/share-event.entity';

export enum KycStatus {
  PENDING   = 'pending',
  SUBMITTED = 'submitted',
  VERIFIED  = 'verified',
  REJECTED  = 'rejected',
}

export enum Tier {
  SILVER = 'silver',
  GOLD   = 'gold',
  BLACK  = 'black',
}

@Entity('users')
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

  // ── Waitlist / Referral ────────────────────────────────────────────────────
  @Column({ name: 'referral_code', type: 'varchar', length: 20, nullable: true, unique: true })
  referralCode: string | null;

  @Column({ name: 'referred_by', type: 'varchar', nullable: true })
  referredBy: string | null;

  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({ name: 'is_flagged', default: false })
  isFlagged: boolean;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  // ── Stellar custodial wallet ───────────────────────────────────────────────
  // Cheese generates this keypair at signup and holds the secret key.
  // The user never sees or manages it.
  @Column({ name: 'stellar_public_key', type: 'varchar', nullable: true, unique: true })
  stellarPublicKey: string | null;

  @Exclude()
  @Column({ name: 'stellar_secret_enc', nullable: true, type: 'text' })
  stellarSecretEnc: string | null;

  // ── EVM wallet address ─────────────────────────────────────────────────────
  // Stored here so WalletService can aggregate the EVM balance in one DB
  // query without going through the EVM contract's user registry on every call.
  @Column({ name: 'evm_address', type: 'varchar', nullable: true, unique: true })
  evmAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Device, (d) => d.user, { cascade: true })
  devices: Device[];

  @OneToMany(() => RefreshToken, (rt) => rt.user, { cascade: true })
  refreshTokens: RefreshToken[];

  @OneToMany(() => Transaction, (tx) => tx.user)
  transactions: Transaction[];

  @OneToMany(() => ShareEvent, (share) => share.user, { nullable: true })
  shareEvents: ShareEvent[];
}