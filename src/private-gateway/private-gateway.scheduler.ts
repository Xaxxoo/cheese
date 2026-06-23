// src/private-gateway/private-gateway.scheduler.ts
//
// Two recurring jobs:
//   1. watchHotWallet    — every minute: polls Stellar hot wallet for USDC
//      payments and matches them to open invoices via memo.
//   2. expireOldInvoices — every 5 min: marks pending invoices past their TTL.
//   3. pollSettlingInvoices — every 5 min: checks PulseMFB status for invoices
//      in SETTLING state and advances them to SETTLED or FAILED.

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { PrivateInvoice, PrivateInvoiceStatus } from './entities/private-invoice.entity';
import { PrivateGatewayService } from './private-gateway.service';
import { BlockchainService } from '../blockchain/services/blockchain.service';

@Injectable()
export class PrivateGatewayScheduler {
  private readonly logger = new Logger(PrivateGatewayScheduler.name);

  // Cursor is kept in memory — survives restarts by starting from 'now'
  // (no backfill needed; hackathon volume is low).
  private hotWalletCursor: string | undefined = undefined;

  constructor(
    @InjectRepository(PrivateInvoice)
    private readonly invoiceRepo: Repository<PrivateInvoice>,
    private readonly gatewayService: PrivateGatewayService,
    private readonly blockchainService: BlockchainService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async watchHotWallet(): Promise<void> {
    try {
      const { payments, nextCursor } = await this.blockchainService.fetchHotWalletPayments(
        this.hotWalletCursor,
      );

      if (nextCursor) this.hotWalletCursor = nextCursor;

      for (const payment of payments) {
        if (!payment.memo) continue;
        try {
          await this.gatewayService.processPlatformPayment(
            payment.txHash,
            payment.from,
            payment.amount,
            payment.memo,
          );
        } catch (err) {
          this.logger.error(
            `processPlatformPayment failed [memo=${payment.memo}]: ${(err as Error).message}`,
          );
        }
      }

      if (payments.length > 0) {
        this.logger.log(`watchHotWallet: processed ${payments.length} USDC payment(s)`);
      }
    } catch (err) {
      this.logger.error(`watchHotWallet error: ${(err as Error).message}`);
    }
  }

  @Cron('*/5 * * * *')
  async expireOldInvoices(): Promise<void> {
    try {
      const result = await this.invoiceRepo.update(
        { status: PrivateInvoiceStatus.PENDING, expiresAt: LessThan(new Date()) },
        { status: PrivateInvoiceStatus.EXPIRED },
      );
      if (result.affected && result.affected > 0) {
        this.logger.log(`Expired ${result.affected} private invoice(s)`);
      }
    } catch (err) {
      this.logger.error(`expireOldInvoices error: ${(err as Error).message}`);
    }
  }

  @Cron('*/5 * * * *')
  async pollSettlingInvoices(): Promise<void> {
    try {
      await this.gatewayService.checkSettlingInvoices();
    } catch (err) {
      this.logger.error(`pollSettlingInvoices error: ${(err as Error).message}`);
    }
  }
}
