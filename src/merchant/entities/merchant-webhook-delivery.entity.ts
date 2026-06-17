import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MerchantWebhook } from './merchant-webhook.entity';

@Entity('merchant_webhook_deliveries')
export class MerchantWebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'webhook_id' })
  webhookId: string;

  @ManyToOne(() => MerchantWebhook, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'webhook_id' })
  webhook: MerchantWebhook;

  @Column({ type: 'varchar' })
  event: string;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus: number | null;

  @Column({ name: 'response_body', type: 'text', nullable: true })
  responseBody: string | null;

  @Column({ name: 'attempt_count', type: 'int', default: 1 })
  attemptCount: number;

  @Column({ type: 'boolean' })
  success: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
