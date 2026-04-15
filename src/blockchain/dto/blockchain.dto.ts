import {
  IsUUID, IsString, IsNotEmpty, IsNumberString,
  IsEnum, IsOptional, IsEthereumAddress, MaxLength,
  IsInt, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TokenSymbol, WalletStatus } from '../entities/blockchain-wallet.entity';
import { BlockchainTxStatus, BlockchainTxType } from '../entities/blockchain-transaction.entity';

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export class CreateWalletDto {
  @IsUUID()
  userId: string;

  /**
   * Username to register on-chain.
   * Must match the user's current Cheese Pay username.
   * Immutable after registration.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  username: string;

  /**
   * EVM address to associate with the wallet.
   * For fully-custodial model, pass the platform address.
   * For self-custodial, pass the user's own EOA.
   */
  @IsEthereumAddress()
  evmAddress: string;
}

export class DebitWalletDto {
  @IsUUID()
  userId: string;

  /**
   * Amount to debit as a human-readable string.
   * e.g. "31.25" for 31.25 USDC.
   * Will be converted to on-chain units using the wallet's tokenDecimals.
   */
  @IsNumberString({}, { message: 'amount must be a numeric string' })
  amount: string;

  /**
   * App-level transaction reference (CHZ-…) used for on-chain idempotency.
   * The contract rejects duplicate refs, preventing double-debits.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  appReference: string;
}

export class CreditWalletDto {
  @IsUUID()
  userId: string;

  @IsNumberString({}, { message: 'amount must be a numeric string' })
  amount: string;

  /**
   * App-level reference for this credit operation.
   * For reversals, use the format: REV-{originalReference}.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  appReference: string;
}

export class TransferByUsernameDto {
  /** Sender's Cheese Pay username (registered on-chain) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  fromUsername: string;

  /** Recipient's Cheese Pay username (must be registered on-chain) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  toUsername: string;

  @IsNumberString({}, { message: 'amount must be a numeric string' })
  amount: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  appReference: string;
}

export class ResolveUsernameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  username: string;
}

export class GetBalanceDto {
  @IsUUID()
  userId: string;
}

export class BlockchainTxFilterDto {
  @IsOptional()
  @IsEnum(BlockchainTxStatus)
  status?: BlockchainTxStatus;

  @IsOptional()
  @IsEnum(BlockchainTxType)
  txType?: BlockchainTxType;

  @IsOptional()
  @IsString()
  appReference?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export class WalletResponseDto {
  id: string;
  userId: string;
  walletAddress: string | null;
  registeredUsername: string;
  chainId: number;
  contractAddress: string;
  tokenSymbol: TokenSymbol;
  tokenDecimals: number;
  status: WalletStatus;
  creationTxHash: string | null;
  activatedAt: string | null;
  createdAt: string;

  static from(wallet: import('../entities/blockchain-wallet.entity').BlockchainWallet): WalletResponseDto {
    const dto = new WalletResponseDto();
    dto.id                 = wallet.id;
    dto.userId             = wallet.userId;
    dto.walletAddress      = wallet.walletAddress;
    dto.registeredUsername = wallet.registeredUsername;
    dto.chainId            = wallet.chainId;
    dto.contractAddress    = wallet.contractAddress;
    dto.tokenSymbol        = wallet.tokenSymbol;
    dto.tokenDecimals      = wallet.tokenDecimals;
    dto.status             = wallet.status;
    dto.creationTxHash     = wallet.creationTxHash;
    dto.activatedAt        = wallet.activatedAt?.toISOString() ?? null;
    dto.createdAt          = wallet.createdAt.toISOString();
    return dto;
  }
}

export class WalletBalanceResponseDto {
  userId: string;
  walletAddress: string;
  tokenSymbol: TokenSymbol;
  /** Live balance read from smart contract. Human-readable, e.g. "31.25000000" */
  balance: string;
  /** ISO UTC timestamp of when this balance was fetched */
  fetchedAt: string;
}

export class BlockchainTransactionResponseDto {
  id: string;
  walletId: string | null;
  appReference: string;
  txType: BlockchainTxType;
  status: BlockchainTxStatus;
  txHash: string | null;
  blockNumber: string | null;
  amount: string | null;
  amountRaw: string | null;
  toAddress: string | null;
  gasUsed: string | null;
  gasPrice: string | null;
  revertReason: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
  createdAt: string;

  static from(
    tx: import('../entities/blockchain-transaction.entity').BlockchainTransaction,
  ): BlockchainTransactionResponseDto {
    const dto = new BlockchainTransactionResponseDto();
    dto.id           = tx.id;
    dto.walletId     = tx.walletId;
    dto.appReference = tx.appReference;
    dto.txType       = tx.txType;
    dto.status       = tx.status;
    dto.txHash       = tx.txHash;
    dto.blockNumber  = tx.blockNumber;
    dto.amount       = tx.amount;
    dto.amountRaw    = tx.amountRaw;
    dto.toAddress    = tx.toAddress;
    dto.gasUsed      = tx.gasUsed;
    dto.gasPrice     = tx.gasPrice;
    dto.revertReason = tx.revertReason;
    dto.submittedAt  = tx.submittedAt?.toISOString() ?? null;
    dto.confirmedAt  = tx.confirmedAt?.toISOString() ?? null;
    dto.createdAt    = tx.createdAt.toISOString();
    return dto;
  }
}

export class OnChainOperationResultDto {
  /** On-chain tx hash */
  txHash: string;
  /** Wallet balance after the operation — live read from contract */
  balanceAfter: string;
  /** The internal blockchain_transaction row created for this operation */
  transaction: BlockchainTransactionResponseDto;
}

export class UsernameResolveResponseDto {
  username: string;
  walletAddress: string | null;
  isRegistered: boolean;
}

export class PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data       = data;
    this.total      = total;
    this.page       = page;
    this.limit      = limit;
    this.totalPages = Math.ceil(total / limit);
  }
}
