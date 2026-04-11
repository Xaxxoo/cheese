// src/wallet/wallet.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  private async processDepositsForUser(user: Pick<User, 'id' | 'stellarPublicKey' | 'stellarDepositCursor'>) {
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
        userId:    user.id,
        type:      TxType.DEPOSIT,
        status:    TxStatus.COMPLETED,
        amountUsdc: payment.amount,
        txHash:    payment.txHash,
        network:   'stellar',
        reference,
        description: `USDC deposit from ${payment.from}`,
      });

      this.logger.log(
        `Deposit recorded [user=${user.id}] [amount=${payment.amount} USDC] [hash=${payment.txHash}]`,
      );
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
