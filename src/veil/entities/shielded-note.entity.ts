// src/veil/entities/shielded-note.entity.ts
//
// A shielded note represents a USDC deposit into the Veil pool.
// The note secret + nullifier are stored encrypted; the commitment
// is public (stored in the Soroban contract).
//
// Privacy model:
//   - The depositor's address is visible in the initial deposit tx
//   - All subsequent payments from this note come from the pool contract
//   - An observer cannot link the deposit to any specific payment

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ShieldedNoteStatus {
  ACTIVE   = 'active',    // note is unspent and available for payments
  SPENT    = 'spent',     // note has been fully used for a payment
  PENDING  = 'pending',   // deposit tx submitted, awaiting confirmation
  FAILED   = 'failed',    // deposit tx failed
}

@Entity('veil_shielded_notes')
@Index('IDX_veil_notes_status', ['status'])
@Index('UQ_veil_notes_commitment', ['commitment'], { unique: true })
export class ShieldedNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /// The Stellar account that made the on-chain USDC deposit (optional — for
  /// linking notes to Cheese users; null if deposited directly by an external wallet)
  @Column({ type: 'uuid', nullable: true, default: null })
  userId: string | null;

  /// commitment = Poseidon(secret, nullifier, amount) — stored in Soroban contract
  @Column({ type: 'varchar', length: 66 })  // "0x" + 64 hex chars
  commitment: string;

  /// Amount in micro-USDC (amount * 1_000_000), e.g. 10_000_000 = 10 USDC
  @Column({ type: 'bigint' })
  amountMicro: string;

  /// Human-readable amount (amountMicro / 1_000_000)
  @Column({ type: 'decimal', precision: 20, scale: 6 })
  amountUsdc: string;

  /// AES-256-GCM encrypted JSON: { secret: string, nullifier: string }
  /// Encrypted with SECRET_ENCRYPTION_KEY so only the backend can decrypt
  @Column({ type: 'text' })
  encryptedNote: string;

  @Column({ type: 'varchar', default: ShieldedNoteStatus.PENDING })
  status: ShieldedNoteStatus;

  /// Stellar tx hash of the on-chain USDC deposit to the pool contract
  @Column({ type: 'varchar', nullable: true, default: null })
  depositTxHash: string | null;

  /// Soroban contract address where the commitment is stored
  @Column({ type: 'varchar', nullable: true, default: null })
  poolContractId: string | null;

  /// Invoice reference this note was spent on (if spent)
  @Column({ type: 'varchar', nullable: true, default: null })
  spentOnInvoice: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
