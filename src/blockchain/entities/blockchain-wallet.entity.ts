import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { BlockchainTransaction } from './blockchain-transaction.entity';

export enum WalletStatus {
  /**
   * createWallet() submitted to chain but tx not yet mined.
   * The scheduler retries these until confirmed or max retries exceeded.
   */
  PENDING = 'pending',
  /** Contract confirmed wallet creation. Ready for all operations. */
  ACTIVE = 'active',
  /** Suspended by admin or risk engine. All contract operations blocked. */
  SUSPENDED = 'suspended',
  /** Permanently deactivated. Cannot be reactivated. */
  REVOKED = 'revoked',
}

export enum TokenSymbol {
  USDC = 'USDC',
  USDT = 'USDT',
}

@Entity('blockchain_wallets')
@Index('UQ_blockchain_wallets_user_id', ['userId'], { unique: true })
@Index('UQ_blockchain_wallets_address', ['walletAddress'], {
  unique: true,
  where: '"wallet_address" IS NOT NULL',
})
@Index('UQ_blockchain_wallets_username', ['registeredUsername'], {
  unique: true,
})
@Index('IDX_blockchain_wallets_status', ['status'])
@Index('IDX_blockchain_wallets_created', ['createdAt'])
export class BlockchainWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * FK to users.id — one wallet per user, enforced at DB level by unique index.
   */
  @Column({ type: 'uuid', unique: true })
  userId: string;

  /**
   * EIP-55 checksummed on-chain wallet address.
   * Null while status = PENDING (contract tx not yet confirmed).
   * Set to non-null exactly once, when the WalletCreated event is parsed.
   * Never changes after that.
   */
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    default: null,
    name: 'wallet_address',
  })
  walletAddress: string | null;

  /**
   * Username registered on-chain at wallet creation time.
   * Immutable — the contract does not support username updates.
   * Even if the user changes their app username, on-chain transfers
   * must use this original value.
   */
  @Column({ type: 'varchar', length: 30 })
  registeredUsername: string;

  /**
   * EVM chain ID for the network this wallet lives on.
   * 1 = Ethereum mainnet, 137 = Polygon, 56 = BSC, 8453 = Base.
   */
  @Column({ type: 'int' })
  chainId: number;

  /**
   * Address of the Cheese Pay contract that created this wallet.
   * Stored so historical wallets retain a reference to the exact
   * contract version, even after contract upgrades.
   */
  @Column({ type: 'varchar', length: 100 })
  contractAddress: string;

  @Column({ type: 'enum', enum: TokenSymbol, default: TokenSymbol.USDC })
  tokenSymbol: TokenSymbol;

  /**
   * Token decimal places — 6 for USDC/USDT on most EVM chains.
   * Stored on the wallet row so all amount conversions stay accurate
   * if a different token with different decimals is ever supported.
   */
  @Column({ type: 'smallint', default: 6 })
  tokenDecimals: number;

  @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.PENDING })
  status: WalletStatus;

  /**
   * On-chain tx hash of the createWallet() call.
   * Set from the TransactionResponse before confirmation, then confirmed
   * once the receipt arrives. Allows tracking even before mining.
   */
  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  creationTxHash: string | null;

  /**
   * How many times wallet creation has been retried after initial failure.
   * Scheduler stops retrying after MAX_CREATION_RETRIES (defined in WalletService).
   */
  @Column({ type: 'smallint', default: 0 })
  retryCount: number;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  lastRetryAt: Date | null;

  /**
   * Timestamp when the wallet transitioned to ACTIVE (contract confirmed).
   */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  activatedAt: Date | null;

  @Column({ type: 'text', nullable: true, default: null })
  suspensionReason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => BlockchainTransaction, (tx) => tx.wallet)
  transactions: BlockchainTransaction[];

  get isReady(): boolean {
    return this.status === WalletStatus.ACTIVE && this.walletAddress !== null;
  }
}
