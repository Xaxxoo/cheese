import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  WalletService,
  MAX_CREATION_RETRIES,
} from '../services/wallet.service';
import { BlockchainTransactionService } from '../services/blockchain-transaction.service';

@Injectable()
export class BlockchainScheduler {
  private readonly logger = new Logger(BlockchainScheduler.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly blockchainTxService: BlockchainTransactionService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryPendingWallets(): Promise<void> {
    try {
      const pendingWallets = await this.walletService.findPendingWallets();

      if (pendingWallets.length === 0) return;

      this.logger.log(
        `Scheduler: retrying ${pendingWallets.length} pending wallet(s)`,
      );

      for (const wallet of pendingWallets) {
        if (wallet.retryCount >= MAX_CREATION_RETRIES) {
          this.logger.error(
            `ALERT: Wallet creation exceeded max retries [userId=${wallet.userId}]` +
              ` [retries=${wallet.retryCount}] — manual intervention required`,
          );
          continue;
        }

        try {
          await this.walletService.retryWalletCreation(wallet.id);
        } catch (err) {
          this.logger.error(
            `Scheduler retry failed [walletId=${wallet.id}] [userId=${wallet.userId}]`,
            err,
          );
        }
      }
    } catch {
      // Blockchain module not active — skip silently
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async alertOnStuckTransactions(): Promise<void> {
    try {
      const stuckTxs = await this.blockchainTxService.findStuckSubmissions(15);

      if (stuckTxs.length === 0) return;

      this.logger.warn(
        `ALERT: ${stuckTxs.length} blockchain transaction(s) stuck in SUBMITTED for >15min:`,
      );

      for (const tx of stuckTxs) {
        this.logger.warn(
          `  [id=${tx.id}] [type=${tx.txType}] [ref=${tx.appReference}]` +
            ` [txHash=${tx.txHash}] [submittedAt=${tx.submittedAt?.toISOString()}]`,
        );
      }
    } catch {
      // Blockchain module not active — skip silently
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyHealthReport(): Promise<void> {
    try {
      const failedCount = await this.blockchainTxService.countFailed();
      const pendingWallets = await this.walletService.findPendingWallets();

      this.logger.log(
        `Daily blockchain health report:` +
          ` failedTxs=${failedCount}` +
          ` pendingWallets=${pendingWallets.length}`,
      );

      if (failedCount > 10) {
        this.logger.error(
          `ALERT: ${failedCount} failed blockchain transactions detected — review required`,
        );
      }
    } catch {
      // Blockchain module not active — skip silently
    }
  }
}
