// src/auth/processors/wallet-creation.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { User, WalletStatus } from '../entities/user.entity';
import { BlockchainService } from '../../blockchain/services/blockchain.service';
import { WalletCreationJobData } from '../auth.service';

/**
 * WalletCreationProcessor
 *
 * Retries failed wallet creation for users whose Stellar or EVM wallet
 * could not be created during signup (e.g. due to network errors or
 * Horizon congestion).
 *
 * BullMQ will retry up to 5 times with exponential backoff (10s base).
 * If all 5 attempts fail, the job is kept in the failed queue for
 * manual inspection — the user can still use the app, but their wallet
 * will show as "pending" until an admin triggers a manual retry.
 *
 * Only the chains listed in job.data.chains are retried. If a chain
 * already has a wallet (e.g. Stellar succeeded during signup but EVM
 * failed), it is skipped.
 */
@Processor('wallet-creation')
export class WalletCreationProcessor extends WorkerHost {
  private readonly logger = new Logger(WalletCreationProcessor.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly blockchainService: BlockchainService,
  ) {
    super();
  }

  async process(job: Job<WalletCreationJobData>): Promise<void> {
    const { userId, username, chains } = job.data;

    this.logger.log(
      `wallet-creation retry [attempt=${job.attemptsMade + 1}]` +
        ` [userId=${userId}] [chains=${chains.join(',')}]`,
    );

    // Re-fetch user — their wallet fields may have been updated since the job was queued
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(
        `WalletCreationProcessor: user ${userId} not found — skipping`,
      );
      return;
    }

    const evmUpdates: Partial<User> = {};
    const stillFailing: string[] = [];

    // ── Stellar ──────────────────────────────────────────────────────────
    // Two-phase approach: generate keypair → atomic DB write → THEN fund.
    // Prevents double-spending if the cron and this processor run concurrently.
    if (chains.includes('stellar')) {
      if (user.stellarPublicKey) {
        // Already created (maybe by the cron or a concurrent job).
        // If stellarWalletStatus is still PENDING the cron's Phase B will
        // retry the activation — nothing more to do here.
        this.logger.debug(
          `Stellar wallet already exists for user ${userId} — skipping`,
        );
      } else {
        try {
          // Phase 1: generate keypair — free, no XLM spent
          const generated = this.blockchainService.generateStellarKeypair();

          // Phase 2: atomic DB write — only write if key is still null.
          // Prevents a race with the provisioning cron.

          const result = await this.userRepo.update(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            { id: userId, stellarPublicKey: null as any },
            {
              stellarPublicKey: generated.publicKey,
              stellarSecretEnc: generated.secretKeyEnc,
            },
          );

          if (result.affected === 0) {
            // Cron (or another instance) already claimed this slot — skip funding.
            this.logger.debug(
              `Stellar key already claimed for user ${userId} — skipping`,
            );
          } else {
            // Phase 3: fund + trustline — XLM spent only after DB write confirmed.
            await this.blockchainService.activateStellarAccount(
              generated.secretKeyEnc,
            );
            await this.userRepo.update(
              { id: userId },
              { stellarWalletStatus: WalletStatus.ACTIVE },
            );
            this.logger.log(
              `Stellar wallet created on retry [userId=${userId}] [pk=${generated.publicKey}]`,
            );
          }
        } catch (err) {
          this.logger.error(
            `Stellar wallet retry failed [userId=${userId}]: ${(err as Error).message}`,
          );
          stillFailing.push('stellar');
        }
      }
    }

    // ── EVM ───────────────────────────────────────────────────────────────
    if (chains.includes('evm')) {
      if (!this.blockchainService.isEvmReady) {
        this.logger.debug(
          `EVM not configured — skipping EVM wallet retry for user ${userId}`,
        );
      } else if (user.evmAddress) {
        this.logger.debug(
          `EVM wallet already exists for user ${userId} — skipping`,
        );
      } else {
        try {
          const evmResult = await this.blockchainService.createEvmWallet(
            userId,
            username,
          );
          evmUpdates.evmAddress = evmResult.walletAddress;
          this.logger.log(
            `EVM wallet created on retry [userId=${userId}] [wallet=${evmResult.walletAddress}]`,
          );
        } catch (err) {
          this.logger.error(
            `EVM wallet retry failed [userId=${userId}]: ${(err as Error).message}`,
          );
          stillFailing.push('evm');
        }
      }
    }

    // Persist EVM updates
    if (Object.keys(evmUpdates).length > 0) {
      await this.userRepo.update({ id: userId }, evmUpdates);
      this.logger.log(
        `Wallet fields updated [userId=${userId}] [fields=${Object.keys(evmUpdates).join(',')}]`,
      );
    }

    // If any chain still failed, throw so BullMQ reschedules the job
    if (stillFailing.length > 0) {
      throw new Error(
        `Wallet creation still failing for chains: ${stillFailing.join(',')}. Will retry.`,
      );
    }

    this.logger.log(
      `Wallet creation complete for all chains [userId=${userId}]`,
    );
  }
}
