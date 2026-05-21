// src/wallet/wallet.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User, WalletStatus } from '../auth/entities/user.entity';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { TransactionsService } from '../transactions/transactions.service';
import { TxStatus, TxType } from '../transactions/entities/transaction.entity';
import {
  BlockchainWallet,
  WalletStatus as BlockchainWalletStatus,
} from '../blockchain/entities/blockchain-wallet.entity';
import { EvmChainCursor } from '../blockchain/entities/evm-chain-cursor.entity';

@Injectable()
export class WalletDepositScheduler {
  private readonly logger = new Logger(WalletDepositScheduler.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(BlockchainWallet)
    private readonly blockchainWalletRepo: Repository<BlockchainWallet>,
    @InjectRepository(EvmChainCursor)
    private readonly cursorRepo: Repository<EvmChainCursor>,
    private readonly blockchainService: BlockchainService,
    private readonly txService: TransactionsService,
  ) {}

  // ── Auto-provision missing Stellar wallets ────────────────────────────────
  // Runs every 2 minutes. Two-phase approach:
  //   Phase A — users with no key: generate key → write DB → THEN fund.
  //             Money is only spent after the DB write succeeds, eliminating
  //             double-spends from concurrent instances or failed DB writes.
  //   Phase B — users with a saved key but PENDING status: retry activation
  //             (handles the rare case where funding failed after the key was
  //             persisted to the DB on a previous run).
  @Cron('*/2 * * * *')
  async provisionMissingWallets() {
    if (!this.blockchainService.isStellarReady) return;

    // ── Phase A: provision users who have no Stellar key yet ───────────────
    const needsKey = await this.userRepo.find({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: { stellarPublicKey: IsNull() },
      select: ['id', 'username'],
      take: 20,
    });

    if (needsKey.length > 0) {
      this.logger.log(
        `Auto-provisioning Stellar wallets for ${needsKey.length} user(s)`,
      );
    }

    for (const user of needsKey) {
      try {
        // Step 1: Generate keypair — free, no network call, no XLM spent.
        const generated = this.blockchainService.generateStellarKeypair();

        // Step 2: Atomic DB write — claim the slot BEFORE spending any XLM.
        // Guards against concurrent instances provisioning the same user.

        const result = await this.userRepo.update(
          { id: user.id, stellarPublicKey: IsNull() },
          {
            stellarPublicKey: generated.publicKey,
            stellarSecretEnc: generated.secretKeyEnc,
          },
        );

        if (result.affected === 0) {
          this.logger.warn(
            `Wallet already provisioned by another instance [user=${user.username}] — skipping`,
          );
          continue;
        }

        // Step 3: Fund + trustline — XLM is spent only after DB write confirmed.
        await this.blockchainService.activateStellarAccount(
          generated.secretKeyEnc,
        );
        await this.userRepo.update(
          { id: user.id },
          { stellarWalletStatus: WalletStatus.ACTIVE },
        );

        this.logger.log(
          `Wallet provisioned [user=${user.username}] [pk=${generated.publicKey}]`,
        );
      } catch (err) {
        this.logger.error(
          `Auto-provision failed [user=${user.username}]: ${(err as Error).message}`,
        );
      }
    }

    // ── Phase B: retry activation for users whose key was saved but funding
    //            failed on a previous run (stellarPublicKey set, status PENDING)
    const needsActivation = await this.userRepo.find({
      where: {
        stellarWalletStatus: WalletStatus.PENDING,
        stellarPublicKey: Not(IsNull()),
      },
      select: ['id', 'username', 'stellarSecretEnc'],
      take: 20,
    });

    for (const user of needsActivation) {
      if (!user.stellarSecretEnc) continue;
      try {
        await this.blockchainService.activateStellarAccount(
          user.stellarSecretEnc,
        );
        await this.userRepo.update(
          { id: user.id },
          { stellarWalletStatus: WalletStatus.ACTIVE },
        );
        this.logger.log(`Wallet activated [user=${user.username}]`);
      } catch (err) {
        const e = err as { message?: string; response?: { data?: unknown } };
        const detail = e.response?.data
          ? ` — horizon: ${JSON.stringify(e.response.data)}`
          : '';
        this.logger.error(
          `Wallet activation retry failed [user=${user.username}]: ${e.message ?? String(err)}${detail}`,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async pollStellarDeposits() {
    if (!this.blockchainService.isStellarReady) {
      return; // Stellar not configured — skip silently
    }

    // Load only users with active Stellar wallets
    const users = await this.userRepo.find({
      where: { stellarWalletStatus: WalletStatus.ACTIVE },
      select: ['id', 'stellarPublicKey', 'stellarDepositCursor'],
    });

    for (const user of users) {
      if (!user.stellarPublicKey) continue;
      try {
        await this.processDepositsForUser(user);
      } catch (err) {
        this.logger.error(
          `Deposit poll failed for user ${user.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async processDepositsForUser(
    user: Pick<User, 'id' | 'stellarPublicKey' | 'stellarDepositCursor'>,
  ) {
    const payments = await this.blockchainService.fetchInboundStellarUsdc(
      user.stellarPublicKey!,
      user.stellarDepositCursor ?? undefined,
    );

    if (payments.length === 0) return;

    // Payments sent from the platform's own wallet are internal operations
    // (bank-transfer refunds, yield credits, etc.) and must not be recorded
    // as user deposits — they are already accounted for by the originating service.
    const platformPublicKey =
      this.blockchainService.getStellarPlatformPublicKey();

    let latestCursor = user.stellarDepositCursor;

    for (const payment of payments) {
      latestCursor = payment.pagingToken;

      // Skip internal platform payments (refunds, credits, etc.)
      if (payment.from === platformPublicKey) continue;

      // A missing txHash means we cannot deduplicate this payment — skip it
      // rather than risk recording it multiple times (nulls bypass UNIQUE constraint).
      if (!payment.txHash) {
        this.logger.warn(
          `Skipping Stellar payment with no txHash [user=${user.id}] [paging=${payment.pagingToken}]`,
        );
        continue;
      }

      const reference = `CW-DEP-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;

      // Atomic INSERT ... ON CONFLICT (tx_hash) DO NOTHING — safe under concurrent
      // cron instances. Returns false when another instance already inserted it.
      const inserted = await this.txService.createDeposit({
        userId: user.id,
        type: TxType.DEPOSIT,
        status: TxStatus.COMPLETED,
        amountUsdc: payment.amount,
        txHash: payment.txHash,
        network: 'stellar',
        reference,
        description: `USDC deposit from ${payment.from}`,
      });

      if (!inserted) continue; // already recorded by a concurrent instance

      this.logger.log(
        `Deposit recorded [user=${user.id}] [amount=${payment.amount} USDC] [hash=${payment.txHash}]`,
      );

      // Notify the Soroban contract of the deposit (fire-and-forget).
      // Routing is purely by destination address — memo is never used.
      if (this.blockchainService.isSorobanReady) {
        void this.blockchainService
          .notifyContractDeposit(user.stellarPublicKey!, payment.amount)
          .catch((err: Error) =>
            this.logger.warn(
              `notifyContractDeposit failed [user=${user.id}] [hash=${payment.txHash}]: ${err.message}`,
            ),
          );
      }
    }

    // Advance the cursor so we don't re-process these payments next run
    if (latestCursor !== user.stellarDepositCursor) {
      await this.userRepo.update(
        { id: user.id },
        { stellarDepositCursor: latestCursor },
      );
    }
  }

  // ── Poll EVM deposits (every 2 minutes) ──────────────────────────────────
  // For each configured EVM chain:
  //   1. Load all ACTIVE wallet addresses for the chain
  //   2. Load/initialise the block cursor from evm_chain_cursors
  //   3. Scan Transfer events from lastProcessedBlock+1 → current block
  //   4. Record new deposits (INSERT ON CONFLICT DO NOTHING for dedup)
  //   5. Advance cursor to toBlock
  @Cron('*/2 * * * *')
  async pollEvmDeposits() {
    if (!this.blockchainService.isEvmReady) return;

    const chains = this.blockchainService.getConfiguredEvmChains();

    for (const { chainId, name } of chains) {
      try {
        await this.pollEvmDepositsForChain(chainId, name);
      } catch (err) {
        this.logger.error(
          `EVM deposit poll failed [chain=${name}/${chainId}]: ${(err as Error).message}`,
        );
      }
    }
  }

  private async pollEvmDepositsForChain(
    chainId: number,
    chainName: string,
  ): Promise<void> {
    // Load all ACTIVE wallet addresses for this chain
    const wallets = await this.blockchainWalletRepo.find({
      where: { chainId, status: BlockchainWalletStatus.ACTIVE },
      select: ['id', 'walletAddress', 'userId'],
    });

    if (wallets.length === 0) return; // no active wallets on this chain yet

    const addresses = wallets
      .filter((w) => w.walletAddress)
      .map((w) => w.walletAddress!);

    if (addresses.length === 0) return;

    // Build address → userId map for deposit recording
    const addrToUserId = new Map(
      wallets
        .filter((w) => w.walletAddress)
        .map((w) => [w.walletAddress!.toLowerCase(), w.userId]),
    );

    // Load cursor (upsert 0 on first run)
    let cursor = await this.cursorRepo.findOne({ where: { chainId } });
    if (!cursor) {
      cursor = this.cursorRepo.create({ chainId, lastProcessedBlock: 0 });
      await this.cursorRepo.save(cursor);
    }

    // Get current chain head
    const toBlock = await this.blockchainService.getEvmBlockNumber(chainId);
    const fromBlock = cursor.lastProcessedBlock + 1;

    if (fromBlock > toBlock) return; // already up to date

    const usdcAddress = this.blockchainService.getEvmUsdcAddress(chainId);
    const usdtAddress = this.blockchainService.getEvmUsdtAddress(chainId);

    const tokenAddresses = [usdcAddress];
    if (usdtAddress) tokenAddresses.push(usdtAddress);

    for (const tokenAddress of tokenAddresses) {
      try {
        const events = await this.blockchainService.getEvmDepositEvents(
          chainId,
          tokenAddress,
          addresses,
          fromBlock,
          toBlock,
        );

        for (const event of events) {
          const userId = addrToUserId.get(event.to.toLowerCase());
          if (!userId) continue;

          const reference = `CW-DEP-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;

          const inserted = await this.txService.createDeposit({
            userId,
            type: TxType.DEPOSIT,
            status: TxStatus.COMPLETED,
            amountUsdc: event.amount,
            txHash: event.txHash,
            network: chainName,
            reference,
            description: `USDC deposit on ${chainName} from ${event.from}`,
          });

          if (inserted) {
            this.logger.log(
              `EVM deposit recorded [chain=${chainName}] [user=${userId}] [amount=${event.amount}] [hash=${event.txHash}]`,
            );
          }
        }
      } catch (err) {
        this.logger.error(
          `EVM event scan failed [chain=${chainName}] [token=${tokenAddress}]: ${(err as Error).message}`,
        );
      }
    }

    // Advance cursor
    await this.cursorRepo.upsert(
      { chainId, lastProcessedBlock: toBlock },
      ['chainId'],
    );
  }
}
