// src/auth/processors/wallet-creation.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { ethers } from 'ethers';
import { User } from '../entities/user.entity';
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

    const updates: Partial<User> = {};
    const stillFailing: string[] = [];

    // ── Stellar ──────────────────────────────────────────────────────────
    if (chains.includes('stellar')) {
      if (user.stellarPublicKey) {
        // Already created (maybe by a concurrent job or manual fix)
        this.logger.debug(
          `Stellar wallet already exists for user ${userId} — skipping`,
        );
      } else {
        try {
          const stellarWallet =
            await this.blockchainService.createStellarWallet();
          updates.stellarPublicKey = stellarWallet.publicKey;
          updates.stellarSecretEnc = stellarWallet.secretKeyEnc;
          this.logger.log(
            `Stellar wallet created on retry [userId=${userId}] [pk=${stellarWallet.publicKey}]`,
          );
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
      if (user.evmAddress) {
        this.logger.debug(
          `EVM wallet already exists for user ${userId} — skipping`,
        );
      } else {
        try {
          const evmKeypair = ethers.Wallet.createRandom();
          const evmResult = await this.blockchainService.createEvmWallet(
            evmKeypair.address,
            username,
          );
          updates.evmAddress = evmResult.walletAddress;
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

    // Persist whatever succeeded
    if (Object.keys(updates).length > 0) {
      await this.userRepo.update({ id: userId }, updates);
      this.logger.log(
        `Wallet fields updated [userId=${userId}] [fields=${Object.keys(updates).join(',')}]`,
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
