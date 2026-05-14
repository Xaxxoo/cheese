import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MerchantUser } from './merchant-user.entity';
import { MerchantStore } from './merchant-store.entity';

export enum MerchantType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
}

export enum MerchantKycStatus {
  NOT_STARTED = 'not_started',
  REVIEW = 'review',
  VERIFIED = 'verified',
}

export enum MerchantKybStatus {
  NOT_REQUIRED = 'not_required',
  REVIEW = 'review',
  VERIFIED = 'verified',
}

export enum SettlementMode {
  INSTANT_FIAT = 'instant_fiat',
  HOLD_USDC = 'hold_usdc',
}

export enum PayoutSchedule {
  INSTANT = 'instant',
  DAILY = 'daily',
  WEEKLY = 'weekly',
}

@Entity('merchants')
export class Merchant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ name: 'legal_name', type: 'varchar', nullable: true })
  legalName: string | null;

  @Column({ name: 'merchant_type', type: 'varchar', default: MerchantType.BUSINESS })
  merchantType: MerchantType;

  @Column({ type: 'varchar', default: 'NG' })
  country: string;

  @Column({ name: 'base_currency', type: 'varchar', default: 'NGN' })
  baseCurrency: string;

  @Column({
    name: 'default_settlement_mode',
    type: 'varchar',
    default: SettlementMode.INSTANT_FIAT,
  })
  defaultSettlementMode: SettlementMode;

  @Column({ name: 'payout_schedule', type: 'varchar', default: PayoutSchedule.INSTANT })
  payoutSchedule: PayoutSchedule;

  @Column({
    name: 'kyc_status',
    type: 'varchar',
    default: MerchantKycStatus.NOT_STARTED,
  })
  kycStatus: MerchantKycStatus;

  @Column({
    name: 'kyb_status',
    type: 'varchar',
    default: MerchantKybStatus.NOT_REQUIRED,
  })
  kybStatus: MerchantKybStatus;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sandbox_mode', default: true })
  sandboxMode: boolean;

  @Column({ name: 'onboarding_complete', default: false })
  onboardingComplete: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => MerchantUser, (u) => u.merchant, { cascade: true })
  users: MerchantUser[];

  @OneToMany(() => MerchantStore, (s) => s.merchant, { cascade: true })
  stores: MerchantStore[];
}
