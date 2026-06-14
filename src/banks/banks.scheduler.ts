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

// Transfers older than this are considered permanently stuck and will be
// marked failed with a refund on the next poll, regardless of provider response.
const FAIL_AFTER_HOURS = 24;

// When PulseMFB returns 404 for a status look-up (transfer not found by our
// reference), we do NOT immediately assume the transfer was never received.
// PulseMFB may have processed the request and sent the money but be unable to
// look it up by external reference, OR their webhook may just be delayed.
// We wait this long before treating "not found" as a genuine non-delivery.
const NOT_FOUND_FAIL_AFTER_MINUTES = 120; // 2 hours

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

    const ageMin = Math.round((Date.now() - transfer.createdAt.getTime()) / 60_000);

    let remoteStatus: string;
    try {
      const remote = await this.pulseMfb.getTransferStatus(queryRef);
      remoteStatus = remote.status;
    } catch (err) {
      // PulseMFB returned 404 for this reference.  This does NOT necessarily
      // mean the transfer was never received — PulseMFB may have processed the
      // request (and sent the money) but be unable to look it up by external
      // reference, or their webhook may simply be delayed.
      //
      // We therefore wait NOT_FOUND_FAIL_AFTER_MINUTES before treating "not
      // found" as a genuine non-delivery.  During that window the webhook can
      // still arrive and resolve the transfer correctly.
      if ((err as { notFoundAtProvider?: boolean }).notFoundAtProvider) {
        if (ageMin < NOT_FOUND_FAIL_AFTER_MINUTES) {
          this.logger.warn(
            `Transfer not found at PulseMFB [ref=${transfer.reference}] [age=${ageMin}m] — ` +
            `waiting until ${NOT_FOUND_FAIL_AFTER_MINUTES}m before marking failed (webhook may still arrive)`,
          );
          return; // leave as PROCESSING, try again on next cron run
        }

        this.logger.warn(
          `Transfer not found at PulseMFB after ${ageMin}m [ref=${transfer.reference}] — marking failed and refunding`,
        );
        try {
          await this.banksService.processWebhook({
            reference: transfer.reference,
            event: 'transfer.failed',
            failureReason: `Transfer not found at provider after ${ageMin}m — assumed not delivered`,
          });
        } catch (webhookErr) {
          this.logger.error(
            `processWebhook(failed) for not-found transfer [ref=${transfer.reference}]: ${(webhookErr as Error).message}`,
          );
        }
        return;
      }

      // Age-based fallback: after 24 h we give up regardless of the error.
      if (ageMin >= FAIL_AFTER_HOURS * 60) {
        this.logger.warn(
          `Transfer exceeded ${FAIL_AFTER_HOURS}h with no resolution [ref=${transfer.reference}] — marking failed and refunding`,
        );
        try {
          await this.banksService.processWebhook({
            reference: transfer.reference,
            event: 'transfer.failed',
            failureReason: `Transfer unresolved after ${FAIL_AFTER_HOURS}h — timed out`,
          });
        } catch (webhookErr) {
          this.logger.error(
            `processWebhook(failed) for aged-out transfer [ref=${transfer.reference}]: ${(webhookErr as Error).message}`,
          );
        }
        return;
      }

      this.logger.warn(
        `Could not poll PulseMFB for [ref=${transfer.reference}]: ${(err as Error).message}`,
      );
      return;
    }

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
