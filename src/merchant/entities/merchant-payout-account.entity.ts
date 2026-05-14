import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Merchant } from './merchant.entity';

@Entity('merchant_payout_accounts')
export class MerchantPayoutAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ name: 'account_type', type: 'varchar' })
  accountType: 'bank' | 'digital_dollar';

  @Column({ type: 'varchar' })
  currency: string;

  @Column({ type: 'varchar' })
  destination: string;

  @Column({ type: 'varchar', default: 'review' })
  status: 'active' | 'review';

  @Column({ name: 'default_for_instant_payout', default: false })
  defaultForInstantPayout: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
