// src/cards/entities/virtual-card.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum CardStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
  TERMINATED = 'terminated',
}
export enum CardNetwork {
  VISA = 'visa',
  MASTERCARD = 'mastercard',
}

@Entity('virtual_cards')
export class VirtualCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  // Stored encrypted — only last4 stored in plain
  @Column({ name: 'card_number_enc', type: 'text' })
  cardNumberEnc: string;

  @Column({ name: 'cvv_enc' })
  cvvEnc: string;

  @Column({ name: 'last4' })
  last4: string;

  @Column({ name: 'expiry_month' })
  expiryMonth: string;

  @Column({ name: 'expiry_year' })
  expiryYear: string;

  @Column({ name: 'holder_name' })
  holderName: string;

  @Column({ type: 'varchar', default: CardNetwork.MASTERCARD })
  network: CardNetwork;

  @Column({ type: 'varchar', default: CardStatus.ACTIVE })
  status: CardStatus;

  @Column({
    name: 'available_balance',
    type: 'decimal',
    precision: 20,
    scale: 6,
    default: 0,
  })
  availableBalance: string;

  @Column({
    name: 'spend_limit',
    type: 'decimal',
    precision: 20,
    scale: 6,
    default: 500,
  })
  spendLimit: string;

  @Column({
    name: 'monthly_spend',
    type: 'decimal',
    precision: 20,
    scale: 6,
    default: 0,
  })
  monthlySpend: string;

  @Column({ name: 'provider_card_id', type: 'varchar', nullable: true })
  providerCardId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;
}
