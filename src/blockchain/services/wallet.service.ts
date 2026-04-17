import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BlockchainWallet,
  WalletStatus,
  TokenSymbol,
} from '../entities/blockchain-wallet.entity';
import {
  BlockchainTransaction,
  BlockchainTxType,
  BlockchainTxStatus,
} from '../entities/blockchain-transaction.entity';
import { BlockchainService } from './blockchain.service';
import { User } from '../../auth/entities/user.entity';
import {
  WalletNotFoundException,
  WalletAlreadyExistsException,
  WalletNotReadyException,
  WalletSuspendedException,
  WalletCreationMaxRetriesException,
} from '../exceptions/blockchain.exceptions';
import {
  WalletResponseDto,
  WalletBalanceResponseDto,
  BlockchainTransactionResponseDto,
} from '../dto/blockchain.dto';

export const MAX_CREATION_RETRIES = 5;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(BlockchainWallet)
    private readonly walletRepo: Repository<BlockchainWallet>,
    @InjectRepository(BlockchainTransaction)
    private readonly txRepo: Repository<BlockchainTransaction>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly blockchainService: BlockchainService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Wallet Creation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a blockchain wallet for a user.
   *
   * Calls the UserWalletFactory.createWallet(userId, username) — the contract
   * deploys a new UserWallet and registers the username on-chain.
   *
   * Steps:
   *   1. Guard against duplicate wallets
   *   2. Insert a PENDING wallet row immediately (so the userId is claimed)
   *   3. Record a SUBMITTED blockchain_transaction row
   *   4. Call the smart contract — this is the real money operation
   *   5. On success: update wallet to ACTIVE, update tx to CONFIRMED
   *   6. On failure: update tx to FAILED, wallet stays PENDING for scheduler retry
   */
  async createWallet(
    userId: string,
    username: string,
  ): Promise<WalletResponseDto> {
    const existing = await this.walletRepo.findOne({ where: { userId } });
    if (existing) throw new WalletAlreadyExistsException(userId);

    const chainId = await this.blockchainService.getChainId();
    const contractAddress = this.blockchainService.getContractAddress();

    // Insert PENDING wallet immediately — claims the userId slot
    const wallet = await this.walletRepo.save(
      this.walletRepo.create({
        userId,
        registeredUsername: username.toLowerCase(),
        walletAddress: null,
        chainId,
        contractAddress,
        tokenSymbol: TokenSymbol.USDC,
        tokenDecimals: 6, // USDC is always 6 decimals
        status: WalletStatus.PENDING,
        retryCount: 0,
      }),
    );

    // Create a tx record before the contract call
    const blockchainTx = await this.txRepo.save(
      this.txRepo.create({
        walletId: wallet.id,
        appReference: userId,
        txType: BlockchainTxType.WALLET_CREATION,
        status: BlockchainTxStatus.SUBMITTED,
        submittedAt: new Date(),
      }),
    );

    try {
      const result = await this.blockchainService.createEvmWallet(
        userId,
        username,
      );

      await this.walletRepo.update(wallet.id, {
        walletAddress: result.walletAddress,
        creationTxHash: result.txHash,
        status: WalletStatus.ACTIVE,
        activatedAt: new Date(),
      });

      await this.txRepo.update(blockchainTx.id, {
        status: BlockchainTxStatus.CONFIRMED,
        txHash: result.txHash,
        blockNumber: result.blockNumber.toString(),
        gasUsed: result.gasUsed,
        toAddress: result.walletAddress,
        confirmedAt: new Date(),
      });

      this.logger.log(
        `Wallet created [userId=${userId}] [wallet=${result.walletAddress}]`,
      );

      return WalletResponseDto.from(
        await this.walletRepo.findOneOrFail({ where: { id: wallet.id } }),
      );
    } catch (err) {
      await this.txRepo.update(blockchainTx.id, {
        status: BlockchainTxStatus.FAILED,
        revertReason: err instanceof Error ? err.message : String(err),
      });

      this.logger.error(
        `Wallet creation failed [userId=${userId}] — will retry`,
        err,
      );

      return WalletResponseDto.from(
        await this.walletRepo.findOneOrFail({ where: { id: wallet.id } }),
      );
    }
  }

  /**
   * Retry wallet creation for a PENDING wallet.
   * Called by BlockchainScheduler — not exposed via HTTP.
   */
  async retryWalletCreation(walletId: string): Promise<void> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet || wallet.status !== WalletStatus.PENDING) return;

    if (wallet.retryCount >= MAX_CREATION_RETRIES) {
      throw new WalletCreationMaxRetriesException(
        wallet.userId,
        wallet.retryCount,
      );
    }

    await this.walletRepo.update(walletId, {
      retryCount: wallet.retryCount + 1,
      lastRetryAt: new Date(),
    });

    const blockchainTx = await this.txRepo.save(
      this.txRepo.create({
        walletId: wallet.id,
        appReference: wallet.userId,
        txType: BlockchainTxType.WALLET_CREATION,
        status: BlockchainTxStatus.SUBMITTED,
        submittedAt: new Date(),
        metadata: { retryAttempt: wallet.retryCount + 1 },
      }),
    );

    try {
      const result = await this.blockchainService.createEvmWallet(
        wallet.userId,
        wallet.registeredUsername,
      );

      await this.walletRepo.update(walletId, {
        walletAddress: result.walletAddress,
        creationTxHash: result.txHash,
        status: WalletStatus.ACTIVE,
        activatedAt: new Date(),
      });

      await this.txRepo.update(blockchainTx.id, {
        status: BlockchainTxStatus.CONFIRMED,
        txHash: result.txHash,
        blockNumber: result.blockNumber.toString(),
        gasUsed: result.gasUsed,
        toAddress: result.walletAddress,
        confirmedAt: new Date(),
      });

      this.logger.log(`Wallet creation retry succeeded [walletId=${walletId}]`);
    } catch (err) {
      await this.txRepo.update(blockchainTx.id, {
        status: BlockchainTxStatus.FAILED,
        revertReason: err instanceof Error ? err.message : String(err),
      });
      this.logger.error(
        `Wallet creation retry ${wallet.retryCount + 1} failed [walletId=${walletId}]`,
        err,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Balance — combined EVM + Stellar
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Return the combined USDC balance across both chains:
   *   - EVM: live read from UserWallet.getBalance() (usdc.balanceOf)
   *   - Stellar: live read from Horizon ledger
   *
   * Either chain may be unavailable (not configured or wallet not created yet),
   * in which case its contribution is 0 and the call still succeeds.
   */
  async getBalance(userId: string): Promise<WalletBalanceResponseDto> {
    const wallet = await this.requireReadyWallet(userId);

    // EVM balance — read from the UserWallet contract
    let evmBalance = '0.00000000';
    try {
      evmBalance = await this.blockchainService.getEvmBalance(
        wallet.walletAddress!,
      );
    } catch (err) {
      this.logger.warn(
        `getBalance: EVM balance fetch failed [userId=${userId}]: ${(err as Error).message}`,
      );
    }

    // Stellar balance — read from Horizon (requires stellarPublicKey on the User row)
    let stellarBalance = '0.0000000';
    try {
      if (this.blockchainService.isStellarReady) {
        const user = await this.userRepo.findOne({
          where: { id: userId },
          select: ['stellarPublicKey'],
        });
        if (user?.stellarPublicKey) {
          stellarBalance = await this.blockchainService.getStellarUsdcBalance(
            user.stellarPublicKey,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `getBalance: Stellar balance fetch failed [userId=${userId}]: ${(err as Error).message}`,
      );
    }

    const total = (parseFloat(evmBalance) + parseFloat(stellarBalance)).toFixed(
      8,
    );

    return {
      userId,
      walletAddress: wallet.walletAddress!,
      tokenSymbol: wallet.tokenSymbol,
      evmBalance,
      stellarBalance,
      totalBalance: total,
      // backward-compat alias
      balance: total,
      fetchedAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Debit — withdraw USDC from the UserWallet
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Debit USDC from a user's on-chain wallet.
   *
   * Calls UserWallet.withdraw(amount, recipientAddress). The recipient is
   * typically the platform's collection address for bank cashouts, or an
   * external EOA for on-chain withdrawals.
   *
   * If recipientAddress is omitted, defaults to the platform signer address
   * (used for internal fund collection before NGN payout).
   */
  async debit(
    userId: string,
    amount: string,
    appReference: string,
    recipientAddress?: string,
  ): Promise<{ txHash: string; balanceAfter: string; blockchainTxId: string }> {
    const wallet = await this.requireReadyWallet(userId);

    // Default recipient = platform signer (funds collected before bank payout)
    const toAddress =
      recipientAddress ?? this.blockchainService.getEvmSignerAddress();

    const blockchainTx = await this.txRepo.save(
      this.txRepo.create({
        walletId: wallet.id,
        appReference,
        txType: BlockchainTxType.DEBIT,
        status: BlockchainTxStatus.SUBMITTED,
        amount,
        amountRaw: this.blockchainService.toUnits(amount).toString(),
        toAddress,
        submittedAt: new Date(),
      }),
    );

    try {
      const result = await this.blockchainService.evmDebit(
        wallet.walletAddress!,
        amount,
        toAddress,
      );

      await this.txRepo.update(blockchainTx.id, {
        status: BlockchainTxStatus.CONFIRMED,
        txHash: result.txHash,
        blockNumber: result.blockNumber.toString(),
        gasUsed: result.gasUsed,
        confirmedAt: new Date(),
        metadata: { balanceAfter: result.balanceAfter },
      });

      return {
        txHash: result.txHash,
        balanceAfter: result.balanceAfter,
        blockchainTxId: blockchainTx.id,
      };
    } catch (err) {
      await this.txRepo.update(blockchainTx.id, {
        status: BlockchainTxStatus.FAILED,
        revertReason: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Credit — send USDC into the UserWallet
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Credit USDC into a user's on-chain wallet.
   *
   * Calls evmCredit which does an ERC-20 transfer from the platform signer
   * directly to the UserWallet address. Any USDC landing in that address
   * (from any sender or chain bridge) is captured by getBalance().
   */
  async credit(
    userId: string,
    amount: string,
    appReference: string,
  ): Promise<{ txHash: string; balanceAfter: string; blockchainTxId: string }> {
    const wallet = await this.requireReadyWallet(userId);

    const blockchainTx = await this.txRepo.save(
      this.txRepo.create({
        walletId: wallet.id,
        appReference,
        txType: BlockchainTxType.CREDIT,
        status: BlockchainTxStatus.SUBMITTED,
        amount,
        amountRaw: this.blockchainService.toUnits(amount).toString(),
        toAddress: wallet.walletAddress!,
        submittedAt: new Date(),
      }),
    );

    try {
      const result = await this.blockchainService.evmCredit(
        wallet.walletAddress!,
        amount,
      );

      await this.txRepo.update(blockchainTx.id, {
        status: BlockchainTxStatus.CONFIRMED,
        txHash: result.txHash,
        blockNumber: result.blockNumber.toString(),
        gasUsed: result.gasUsed,
        confirmedAt: new Date(),
        metadata: { balanceAfter: result.balanceAfter },
      });

      return {
        txHash: result.txHash,
        balanceAfter: result.balanceAfter,
        blockchainTxId: blockchainTx.id,
      };
    } catch (err) {
      await this.txRepo.update(blockchainTx.id, {
        status: BlockchainTxStatus.FAILED,
        revertReason: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Transfer by username
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * P2P USDC transfer via the factory.
   *
   * Note: the contract does not accept an app reference. Idempotency is
   * enforced at the DB layer via the blockchain_transactions.app_reference
   * unique constraint.
   */
  async transferByUsername(
    fromUserId: string,
    toUsername: string,
    amount: string,
    appReference: string,
  ): Promise<{ txHash: string; balanceAfter: string; blockchainTxId: string }> {
    const senderWallet = await this.requireReadyWallet(fromUserId);

    const toAddress =
      await this.blockchainService.resolveEvmUsername(toUsername);

    const blockchainTx = await this.txRepo.save(
      this.txRepo.create({
        walletId: senderWallet.id,
        appReference,
        txType: BlockchainTxType.TRANSFER,
        status: BlockchainTxStatus.SUBMITTED,
        amount,
        amountRaw: this.blockchainService.toUnits(amount).toString(),
        toAddress: toAddress ?? toUsername,
        submittedAt: new Date(),
        metadata: { toUsername, fromUsername: senderWallet.registeredUsername },
      }),
    );

    try {
      const result = await this.blockchainService.evmTransferByUsername(
        senderWallet.registeredUsername,
        toUsername,
        amount,
      );

      await this.txRepo.update(blockchainTx.id, {
        status: BlockchainTxStatus.CONFIRMED,
        txHash: result.txHash,
        blockNumber: result.blockNumber.toString(),
        gasUsed: result.gasUsed,
        confirmedAt: new Date(),
        metadata: {
          toUsername,
          fromUsername: senderWallet.registeredUsername,
          balanceAfter: result.balanceAfter,
        },
      });

      return {
        txHash: result.txHash,
        balanceAfter: result.balanceAfter,
        blockchainTxId: blockchainTx.id,
      };
    } catch (err) {
      await this.txRepo.update(blockchainTx.id, {
        status: BlockchainTxStatus.FAILED,
        revertReason: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Username resolution
  // ─────────────────────────────────────────────────────────────────────────

  async resolveUsername(
    username: string,
  ): Promise<{ walletAddress: string | null; isRegistered: boolean }> {
    const walletAddress =
      await this.blockchainService.resolveEvmUsername(username);
    return { walletAddress, isRegistered: walletAddress !== null };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────────────────

  async getWalletByUserId(userId: string): Promise<WalletResponseDto> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new WalletNotFoundException(userId);
    return WalletResponseDto.from(wallet);
  }

  async getTransactionHistory(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: BlockchainTransactionResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new WalletNotFoundException(userId);

    const [txs, total] = await this.txRepo.findAndCount({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: txs.map((tx) => BlockchainTransactionResponseDto.from(tx)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Admin operations
  // ─────────────────────────────────────────────────────────────────────────

  async suspendWallet(
    userId: string,
    reason: string,
  ): Promise<WalletResponseDto> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new WalletNotFoundException(userId);
    await this.walletRepo.update(wallet.id, {
      status: WalletStatus.SUSPENDED,
      suspensionReason: reason,
    });
    return WalletResponseDto.from(
      await this.walletRepo.findOneOrFail({ where: { id: wallet.id } }),
    );
  }

  async reinstateWallet(userId: string): Promise<WalletResponseDto> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new WalletNotFoundException(userId);
    await this.walletRepo.update(wallet.id, {
      status: WalletStatus.ACTIVE,
      suspensionReason: null,
    });
    return WalletResponseDto.from(
      await this.walletRepo.findOneOrFail({ where: { id: wallet.id } }),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helpers (used by scheduler)
  // ─────────────────────────────────────────────────────────────────────────

  async findPendingWallets(): Promise<BlockchainWallet[]> {
    return this.walletRepo.find({ where: { status: WalletStatus.PENDING } });
  }

  async requireReadyWallet(userId: string): Promise<BlockchainWallet> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });

    if (!wallet) throw new WalletNotFoundException(userId);

    if (wallet.status === WalletStatus.SUSPENDED) {
      throw new WalletSuspendedException(wallet.walletAddress ?? userId);
    }

    if (!wallet.isReady) {
      throw new WalletNotReadyException(userId);
    }

    return wallet;
  }
}
