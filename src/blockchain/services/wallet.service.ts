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
    private readonly blockchainService: BlockchainService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Wallet Creation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a blockchain wallet for a user.
   *
   * Steps:
   *   1. Guard against duplicate wallets
   *   2. Insert a PENDING wallet row immediately (so the userId is claimed)
   *   3. Record a SUBMITTED blockchain_transaction row
   *   4. Call the smart contract — this is the real money operation
   *   5. On success: update wallet to ACTIVE, update tx to CONFIRMED
   *   6. On failure: update tx to FAILED, wallet stays PENDING for scheduler retry
   *
   * Returning a PENDING wallet is valid — callers must check wallet.isReady
   * before attempting debit/credit. The scheduler (BlockchainScheduler) retries
   * PENDING wallets that have not exceeded MAX_CREATION_RETRIES.
   */
  async createWallet(
    userId: string,
    username: string,
    evmAddress: string,
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
        tokenDecimals: this.blockchainService.getTokenDecimals(),
        status: WalletStatus.PENDING,
        retryCount: 0,
      }),
    );

    // Create a tx record before the contract call
    const blockchainTx = await this.txRepo.save(
      this.txRepo.create({
        walletId: wallet.id,
        appReference: userId, // wallet creation keyed by userId
        txType: BlockchainTxType.WALLET_CREATION,
        status: BlockchainTxStatus.SUBMITTED,
        submittedAt: new Date(),
      }),
    );

    try {
      const result = await this.blockchainService.createWallet(
        evmAddress,
        username,
      );

      // Update wallet to ACTIVE
      await this.walletRepo.update(wallet.id, {
        walletAddress: result.walletAddress,
        creationTxHash: result.txHash,
        status: WalletStatus.ACTIVE,
        activatedAt: new Date(),
      });

      // Update tx to CONFIRMED
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
      // Contract call failed — leave wallet PENDING for scheduler retry
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
  async retryWalletCreation(
    walletId: string,
    evmAddress: string,
  ): Promise<void> {
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
      const platformAddress = this.blockchainService.getSignerAddress();
      const result = await this.blockchainService.createWallet(
        evmAddress || platformAddress,
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
  // Balance
  // ─────────────────────────────────────────────────────────────────────────

  async getBalance(userId: string): Promise<WalletBalanceResponseDto> {
    const wallet = await this.requireReadyWallet(userId);

    const balance = await this.blockchainService.getBalance(
      wallet.walletAddress!,
    );

    return {
      userId,
      walletAddress: wallet.walletAddress!,
      tokenSymbol: wallet.tokenSymbol,
      balance,
      fetchedAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Debit
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Debit USDC/USDT from a user's on-chain wallet.
   *
   * Execution order:
   *   1. Validate wallet is ACTIVE
   *   2. Record a SUBMITTED blockchain_transaction row
   *   3. Call smart contract — this is the irreversible money movement
   *   4. On success: update tx to CONFIRMED, return result
   *   5. On failure: update tx to FAILED, re-throw for caller to handle
   */
  async debit(
    userId: string,
    amount: string,
    appReference: string,
  ): Promise<{ txHash: string; balanceAfter: string; blockchainTxId: string }> {
    const wallet = await this.requireReadyWallet(userId);

    const blockchainTx = await this.txRepo.save(
      this.txRepo.create({
        walletId: wallet.id,
        appReference,
        txType: BlockchainTxType.DEBIT,
        status: BlockchainTxStatus.SUBMITTED,
        amount,
        amountRaw: this.blockchainService.toUnits(amount).toString(),
        submittedAt: new Date(),
      }),
    );

    try {
      const result = await this.blockchainService.debit(
        wallet.walletAddress!,
        amount,
        appReference,
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
  // Credit
  // ─────────────────────────────────────────────────────────────────────────

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
      const result = await this.blockchainService.credit(
        wallet.walletAddress!,
        amount,
        appReference,
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

  async transferByUsername(
    fromUserId: string,
    toUsername: string,
    amount: string,
    appReference: string,
  ): Promise<{ txHash: string; balanceAfter: string; blockchainTxId: string }> {
    const senderWallet = await this.requireReadyWallet(fromUserId);

    // Resolve recipient wallet address for the tx record
    const toAddress = await this.blockchainService.resolveUsername(toUsername);

    const blockchainTx = await this.txRepo.save(
      this.txRepo.create({
        walletId: senderWallet.id,
        appReference,
        txType: BlockchainTxType.TRANSFER,
        status: BlockchainTxStatus.SUBMITTED,
        amount,
        amountRaw: this.blockchainService.toUnits(amount).toString(),
        toAddress: toAddress ?? toUsername, // store address or username if unresolved
        submittedAt: new Date(),
        metadata: { toUsername, fromUsername: senderWallet.registeredUsername },
      }),
    );

    try {
      const result = await this.blockchainService.transferByUsername(
        senderWallet.registeredUsername,
        toUsername,
        amount,
        appReference,
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
      await this.blockchainService.resolveUsername(username);
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
  // Internal helpers (used by scheduler and other services)
  // ─────────────────────────────────────────────────────────────────────────

  async findPendingWallets(): Promise<BlockchainWallet[]> {
    return this.walletRepo.find({ where: { status: WalletStatus.PENDING } });
  }

  /**
   * Validate wallet exists, is ACTIVE, and has a confirmed on-chain address.
   * Throws a typed exception otherwise.
   */
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
