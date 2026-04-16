import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BlockchainWallet } from './blockchain-wallet.entity';

export enum BlockchainTxType {
  WALLET_CREATION = 'wallet_creation',
  DEBIT = 'debit',
  CREDIT = 'credit',
  TRANSFER = 'transfer',
}

export enum BlockchainTxStatus {
  /**
   * Transaction submitted to the mempool — hash available but not yet mined.
   */
  SUBMITTED = 'submitted',
  /**
   * Transaction mined and confirmed (≥ 1 block confirmation).
   */
  CONFIRMED = 'confirmed',
  /**
   * Transaction reverted on-chain (contract threw).
   */
  REVERTED = 'reverted',
  /**
   * RPC call failed before a tx hash was obtained (network error, nonce issue, etc.)
   */
  FAILED = 'failed',
}

@Entity('blockchain_transactions')
@Index('IDX_blockchain_tx_wallet_id', ['walletId'])
@Index('IDX_blockchain_tx_status', ['status'])
@Index('IDX_blockchain_tx_type', ['txType'])
@Index('IDX_blockchain_tx_app_reference', ['appReference'])
@Index('IDX_blockchain_tx_hash', ['txHash'])
@Index('IDX_blockchain_tx_created', ['createdAt'])
export class BlockchainTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * FK to blockchain_wallets — the wallet that was the primary actor
   * in this transaction (sender for debit/transfer, target for credit).
   * Null for wallet_creation type before the wallet row exists.
   */
  @Column({ type: 'uuid', nullable: true })
  walletId: string | null;

  /**
   * App-level reference that triggered this blockchain tx.
   * For payments: the CHZ-{timestamp}-{suffix} reference from the accounting module.
   * For wallet creation: the userId.
   * Stored for correlation — one app reference can produce multiple blockchain txs
   * (e.g., original + reversal).
   */
  @Column({ type: 'varchar', length: 100 })
  @Index('IDX_blockchain_tx_app_ref', {})
  appReference: string;

  @Column({ type: 'enum', enum: BlockchainTxType })
  txType: BlockchainTxType;

  @Column({
    type: 'enum',
    enum: BlockchainTxStatus,
    default: BlockchainTxStatus.SUBMITTED,
  })
  status: BlockchainTxStatus;

  /**
   * On-chain transaction hash (0x…). Available as soon as the tx is submitted.
   * Null only if the RPC call itself failed before obtaining a hash.
   */
  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  txHash: string | null;

  /**
   * Block number where the tx was mined. Null until confirmed.
   */
  @Column({ type: 'bigint', nullable: true, default: null })
  blockNumber: string | null;

  /**
   * Amount in human-readable format, e.g. "31.25000000".
   * Null for wallet_creation type (no token transfer involved).
   */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
    default: null,
  })
  amount: string | null;

  /**
   * Amount as submitted to the contract in raw token units (before decimal scaling).
   * Stored for debugging — e.g. "31250000" for 31.25 USDC (6 decimals).
   */
  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  amountRaw: string | null;

  /**
   * For TRANSFER type: the recipient wallet address.
   * For DEBIT: the treasury address.
   * For CREDIT: the user wallet address.
   * For WALLET_CREATION: the new wallet address (null until confirmed).
   */
  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  toAddress: string | null;

  /**
   * Gas used in wei (from receipt). Null until confirmed.
   */
  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  gasUsed: string | null;

  /**
   * Gas price in wei at time of submission. Null if unavailable.
   */
  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  gasPrice: string | null;

  /**
   * Revert reason if status = REVERTED. Decoded from receipt or ABI.
   */
  @Column({ type: 'text', nullable: true, default: null })
  revertReason: string | null;

  /**
   * Free-form JSONB for extra data: decoded event args, webhook payloads,
   * retry metadata, raw receipt fields that don't have a dedicated column.
   */
  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  /**
   * When the transaction was submitted to the RPC node.
   */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  submittedAt: Date | null;

  /**
   * When the transaction was confirmed on-chain (mined).
   */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  confirmedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => BlockchainWallet, (w) => w.transactions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'walletId' })
  wallet: BlockchainWallet;
}
