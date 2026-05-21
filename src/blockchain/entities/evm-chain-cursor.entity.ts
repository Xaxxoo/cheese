import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Tracks the last processed block per EVM chain for deposit polling.
 * One row per chain — the scheduler upserts this after each poll run.
 */
@Entity('evm_chain_cursors')
export class EvmChainCursor {
  @PrimaryColumn({ type: 'int' })
  chainId: number;

  @Column({ type: 'int', default: 0 })
  lastProcessedBlock: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
