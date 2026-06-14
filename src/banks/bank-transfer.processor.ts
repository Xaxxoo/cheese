// src/banks/bank-transfer.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BanksService, BankTransferJobData } from './banks.service';

/**
 * BankTransferProcessor
 *
 * Consumes jobs from the `bank-transfer` queue and executes the transfer SAGA:
 *   Step 1 — Deduct USDC from the user's Stellar wallet → platform wallet
 *   Step 2 — Initiate NGN payout via PulseMFB
 *
 * If PulseMFB definitively rejects the transfer after USDC has been deducted,
 * the SAGA compensating transaction runs automatically: USDC is refunded from
 * the platform wallet back to the user (rollback).
 *
 * Timeouts from PulseMFB leave the transfer in PROCESSING state — the
 * BanksScheduler cron job and PulseMFB webhooks act as the safety net.
 *
 * The processor never throws — all outcomes are handled internally by
 * executeTransferSaga so BullMQ does not retry partial SAGA steps, which
 * could cause double-charges or double-sends.
 */
@Processor('bank-transfer')
export class BankTransferProcessor extends WorkerHost {
  private readonly logger = new Logger(BankTransferProcessor.name);

  constructor(private readonly banksService: BanksService) {
    super();
  }

  async process(job: Job<BankTransferJobData>): Promise<void> {
    this.logger.log(
      `Processing bank transfer [ref=${job.data.reference}] [attempt=${job.attemptsMade + 1}]`,
    );
    await this.banksService.executeTransferSaga(job.data);
  }
}
