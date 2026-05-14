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

export enum MerchantPaymentStatus {
  PENDING = 'pending',
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
  CONFIRMED = 'confirmed',
  SETTLING = 'settling',
  SETTLED = 'settled',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export enum PaymentRequestKind {
  PAYMENT_LINK = 'payment_link',
  INVOICE = 'invoice',
  CHECKOUT_SESSION = 'checkout_session',
  QR_STATIC = 'qr_static',
  QR_DYNAMIC = 'qr_dynamic',
  API_REQUEST = 'api_request',
}

@Entity('merchant_payments')
export class MerchantPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({ unique: true })
  reference: string;

  @Column({ name: 'request_kind', type: 'varchar', default: PaymentRequestKind.PAYMENT_LINK })
  requestKind: PaymentRequestKind;

  @Column({ name: 'status', type: 'varchar', default: MerchantPaymentStatus.PENDING })
  status: MerchantPaymentStatus;

  @Column({ name: 'fiat_amount', type: 'decimal', precision: 20, scale: 2, default: 0 })
  fiatAmount: number;

  @Column({ name: 'fiat_currency', type: 'varchar', default: 'NGN' })
  fiatCurrency: string;

  @Column({ name: 'digital_dollar_amount', type: 'decimal', precision: 20, scale: 6, default: 0 })
  digitalDollarAmount: number;

  @Column({ name: 'customer_name', type: 'varchar', nullable: true })
  customerName: string | null;

  @Column({ name: 'customer_email', type: 'varchar', nullable: true })
  customerEmail: string | null;

  @Column({ name: 'settlement_mode', type: 'varchar', default: 'instant_fiat' })
  settlementMode: string;

  @Column({ name: 'settlement_currency', type: 'varchar', default: 'NGN' })
  settlementCurrency: string;

  @Column({ name: 'network', type: 'varchar', nullable: true })
  network: string | null;

  @Column({ name: 'tx_hash', type: 'varchar', nullable: true })
  txHash: string | null;

  @Column({ name: 'processing_fee', type: 'decimal', precision: 20, scale: 6, default: 0 })
  processingFee: number;

  @Column({ name: 'settlement_fee', type: 'decimal', precision: 20, scale: 6, default: 0 })
  settlementFee: number;

  @Column({ name: 'speed', type: 'varchar', nullable: true })
  speed: string | null;

  @Column({ name: 'cost_efficiency', type: 'varchar', nullable: true })
  costEfficiency: string | null;

  @Column({ name: 'store_name', type: 'varchar', nullable: true })
  storeName: string | null;

  @Column({ name: 'callback_url', type: 'varchar', nullable: true })
  callbackUrl: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata: Record<string, string>;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'settled_at', type: 'timestamp', nullable: true })
  settledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
