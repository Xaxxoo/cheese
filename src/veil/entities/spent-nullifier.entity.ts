// src/veil/entities/spent-nullifier.entity.ts
//
// Off-chain mirror of the on-chain nullifier registry.
// Allows fast double-spend checks without querying the Soroban contract.

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('veil_spent_nullifiers')
@Index('UQ_veil_nullifiers_hash', ['nullifierHash'], { unique: true })
export class SpentNullifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /// Poseidon(nullifier) — the on-chain double-spend tag
  @Column({ type: 'varchar', length: 66 })
  nullifierHash: string;

  /// Invoice reference this nullifier was used for
  @Column({ type: 'varchar' })
  invoiceRef: string;

  /// Soroban withdrawal tx hash
  @Column({ type: 'varchar', nullable: true, default: null })
  sorobanTxHash: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  usedAt: Date;
}
