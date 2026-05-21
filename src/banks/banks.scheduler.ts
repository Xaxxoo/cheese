// src/banks/banks.scheduler.ts
//
// Periodically polls PulseMFB for the status of any PENDING or PROCESSING
// bank transfers that have not received a webhook within 10 minutes.
//
// This is the safety net for the timeout scenario: when our HTTP request to
// PulseMFB times out (30 s), we cannot tell whether the transfer was received.
// We leave the transfer in PROCESSING and wait for either the webhook or this
// poller to resolve it — without ever doing a premature refund.

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { BankTransfer, BankTransferStatus } from './entities/bank-transfer.entity';
import { BanksService } from './banks.service';
import { PulseMfbClient } from './pulsemfb.client';

// How old a transfer must be before we start polling it.
// Gives normal webhook delivery time to arrive first.
const POLL_AFTER_MINUTES = 10;

// Maximum transfers to process per run — prevents thundering-herd against PulseMFB.
const MAX_PER_RUN = 20;

@Injectable()
export class BanksScheduler {
  private readonly logger = new Logger(BanksScheduler.name);

  constructor(
    @InjectRepository(BankTransfer)
    private readonly transferRepo: Repository<BankTransfer>,
    private readonly banksService: BanksService,
    private readonly pulseMfb: PulseMfbClient,
  ) {}

  // Runs every 5 minutes. Resolves any transfer that has been sitting in
  // PENDING or PROCESSING for more than POLL_AFTER_MINUTES.
  @Cron('*/5 * * * *')
  async pollStuckTransfers(): Promise<void> {
    if (!this.pulseMfb.isReady) return;

    const cutoff = new Date(Date.now() - POLL_AFTER_MINUTES * 60 * 1000);

    const stuck = await this.transferRepo.find({
      where: {
        status: In([BankTransferStatus.PENDING, BankTransferStatus.PROCESSING]),
        createdAt: LessThan(cutoff),
      },
      select: ['id', 'reference', 'providerReference', 'status', 'createdAt'],
      take: MAX_PER_RUN,
      order: { createdAt: 'ASC' }, // oldest first — highest priority
    });

    if (stuck.length === 0) return;

    this.logger.log(`Polling ${stuck.length} stuck bank transfer(s) older than ${POLL_AFTER_MINUTES} min`);

    for (const transfer of stuck) {
      await this.resolveTransfer(transfer);
    }
  }

  private async resolveTransfer(
    transfer: Pick<BankTransfer, 'id' | 'reference' | 'providerReference' | 'status' | 'createdAt'>,
  ): Promise<void> {
    // When the initial request timed out we have no providerReference — query
    // by our own reference (PulseMFB also indexes by external reference).
    const queryRef = transfer.providerReference ?? transfer.reference;

    let remoteStatus: string;
    try {
      const remote = await this.pulseMfb.getTransferStatus(queryRef);
      remoteStatus = remote.status;
    } catch (err) {
      this.logger.warn(
        `Could not poll PulseMFB for [ref=${transfer.reference}]: ${(err as Error).message}`,
      );
      return;
    }

    const ageMin = Math.round((Date.now() - transfer.createdAt.getTime()) / 60_000);

    if (remoteStatus === 'completed') {
      try {
        await this.banksService.processWebhook({
          reference: transfer.reference,
          event: 'transfer.success',
        });
        this.logger.log(
          `Stuck transfer resolved COMPLETED [ref=${transfer.reference}] [age=${ageMin}m] [queryRef=${queryRef}]`,
        );
      } catch (err) {
        this.logger.error(
          `processWebhook(success) failed for [ref=${transfer.reference}]: ${(err as Error).message}`,
        );
      }
      return;
    }

    if (remoteStatus === 'failed') {
      try {
        await this.banksService.processWebhook({
          reference: transfer.reference,
          event: 'transfer.failed',
          failureReason: 'Failed — detected via scheduled status poll',
        });
        this.logger.log(
          `Stuck transfer resolved FAILED [ref=${transfer.reference}] [age=${ageMin}m] [queryRef=${queryRef}]`,
        );
      } catch (err) {
        this.logger.error(
          `processWebhook(failed) failed for [ref=${transfer.reference}]: ${(err as Error).message}`,
        );
      }
      return;
    }

    // Still pending/processing at PulseMFB — nothing to do yet
    this.logger.debug(
      `Transfer still ${remoteStatus} at provider [ref=${transfer.reference}] [age=${ageMin}m]`,
    );
  }
}
