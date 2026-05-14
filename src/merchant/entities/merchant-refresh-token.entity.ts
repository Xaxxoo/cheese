import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MerchantUser } from './merchant-user.entity';

@Entity('merchant_refresh_tokens')
export class MerchantRefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_user_id' })
  merchantUserId: string;

  @ManyToOne(() => MerchantUser, (u) => u.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_user_id' })
  merchantUser: MerchantUser;

  @Column({ name: 'token_hash', unique: true })
  tokenHash: string;

  @Column({ name: 'is_revoked', default: false })
  isRevoked: boolean;

  @Column({
    name: 'expires_at',
    type: 'bigint',
    transformer: {
      from: (value: number) => new Date(Number(value)),
      to: (value: Date) => value.getTime(),
    },
  })
  expiresAt: Date;

  @Column({ name: 'user_agent', type: 'varchar', nullable: true })
  userAgent: string | null;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
