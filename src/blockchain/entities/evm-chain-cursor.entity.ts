import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Tracks the last processed block per EVM chain for deposit polling.
 * One row per chain — the scheduler upserts this after each poll run.
 *
 * Column names use camelCase to match the project's existing DB convention
 * (see blockchain_wallets which stores "userId", "chainId", etc.).
 */
@Entity('evm_chain_cursors')
export class EvmChainCursor {
  @PrimaryColumn({ type: 'int', name: 'chainId' })
  chainId: number;

  @Column({ type: 'int', default: 0, name: 'lastProcessedBlock' })
  lastProcessedBlock: number;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updatedAt' })
  updatedAt: Date;
}
