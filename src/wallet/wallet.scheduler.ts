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

@Injectable()
export class WalletDepositScheduler {
  private readonly logger = new Logger(WalletDepositScheduler.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
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
      where: { stellarPublicKey: null as any },
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          { id: user.id, stellarPublicKey: null as any },
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
        this.logger.error(
          `Wallet activation retry failed [user=${user.username}]: ${(err as Error).message}`,
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

    let latestCursor = user.stellarDepositCursor;

    for (const payment of payments) {
      latestCursor = payment.pagingToken;

      // Skip if we've already recorded this payment
      const exists = await this.txService.existsByTxHash(payment.txHash);
      if (exists) continue;

      const reference = `CW-DEP-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;

      await this.txService.create({
        userId: user.id,
        type: TxType.DEPOSIT,
        status: TxStatus.COMPLETED,
        amountUsdc: payment.amount,
        txHash: payment.txHash,
        network: 'stellar',
        reference,
        description: `USDC deposit from ${payment.from}`,
      });

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
}
