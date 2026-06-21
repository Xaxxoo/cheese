// src/referral/referral.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../auth/entities/user.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { TxStatus, TxType } from '../transactions/entities/transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { Referral, ReferralStatus } from './entities/referral.entity';

const REFERRAL_REWARD_USDC = 2.0; // $2 USDC per qualified referral

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    @InjectRepository(Referral)
    private readonly referralRepo: Repository<Referral>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly txService: TransactionsService,
    private readonly notifService: NotificationsService,
    private readonly blockchainService: BlockchainService,
  ) {}

  // ── GET /referral ─────────────────────────────────────────
  async getSummary(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const referrals = await this.referralRepo.find({
      where: { referrerId: userId },
    });

    const pending = referrals.filter(
      (r) => r.status === ReferralStatus.PENDING,
    ).length;
    const rewarded = referrals.filter(
      (r) => r.status === ReferralStatus.REWARDED,
    );
    const totalEarned = rewarded.reduce(
      (sum, r) => sum + parseFloat(r.rewardUsdc || '0'),
      0,
    );

    const referralCode = this.generateReferralCode(user);
    const referralUrl = `https://cheesepay.xyz/signup?ref=${referralCode}`;

    return {
      code: referralCode,
      link: referralUrl,
      totalReferrals: referrals.length,
      pendingReward: pending * REFERRAL_REWARD_USDC,
      paidReward: totalEarned,
    };
  }

  // ── Internal: link referral on signup ─────────────────────
  async linkReferral(refereeId: string, referralCode: string): Promise<void> {
    if (!referralCode || referralCode.length < 3) return;

    // Try exact referralCode column first (new users with 8-char random code).
    // Fall back to username match for legacy users whose referralCode is null
    // and whose share link therefore contains their username in uppercase.
    let referrer = await this.userRepo.findOne({ where: { referralCode } });
    if (!referrer) {
      referrer = await this.userRepo.findOne({
        where: { username: referralCode.toLowerCase() },
      });
    }
    if (!referrer || referrer.id === refereeId) return;

    // Prevent duplicate referral
    const existing = await this.referralRepo.findOne({ where: { refereeId } });
    if (existing) return;

    await this.referralRepo.save(
      this.referralRepo.create({
        referrerId: referrer.id,
        refereeId,
        status: ReferralStatus.PENDING,
      }),
    );

    this.logger.log(`Referral linked: ${refereeId} → ${referrer.username}`);
  }

  // ── Internal: qualify referral on first transaction ───────
  async qualifyReferral(refereeId: string): Promise<void> {
    const referral = await this.referralRepo.findOne({
      where: { refereeId, status: ReferralStatus.PENDING },
    });

    if (!referral) return;

    // Conditional update: only proceed if THIS call wins the race.
    // If two transactions complete simultaneously both read PENDING, but
    // only one UPDATE WHERE status=PENDING will affect a row — the other
    // gets affected=0 and exits, preventing a double reward credit.
    const result = await this.referralRepo.update(
      { id: referral.id, status: ReferralStatus.PENDING },
      { status: ReferralStatus.QUALIFIED },
    );

    if (!result.affected) return;

    // Credit reward to referrer
    await this.creditReward(referral);
  }

  // ── Private: credit USDC reward ───────────────────────────
  private async creditReward(referral: Referral): Promise<void> {
    const rewardUsdc = String(REFERRAL_REWARD_USDC);
    const reference = `CW-REF-${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    // Load referrer to get their Stellar address
    const referrer = await this.userRepo.findOne({
      where: { id: referral.referrerId },
    });
    if (!referrer?.stellarPublicKey) {
      this.logger.error(
        `Cannot credit referral reward: referrer ${referral.referrerId} has no Stellar address`,
      );
      await this.referralRepo.update(
        { id: referral.id },
        { status: ReferralStatus.PENDING },
      );
      return;
    }

    // Send USDC on-chain from platform treasury
    let txHash: string;
    try {
      txHash = await this.blockchainService.platformDepositUsdc(
        referrer.stellarPublicKey,
        rewardUsdc,
      );
    } catch (err) {
      // Roll back to PENDING so the next qualifying transaction retries
      this.logger.error(
        `On-chain referral send failed for ${referral.referrerId} — rolling back to PENDING: ${(err as Error).message}`,
      );
      await this.referralRepo.update(
        { id: referral.id },
        { status: ReferralStatus.PENDING },
      );
      return;
    }

    // On-chain send succeeded — persist the DB records
    try {
      await this.txService.create({
        userId: referral.referrerId,
        type: TxType.REFERRAL_BONUS,
        status: TxStatus.COMPLETED,
        amountUsdc: rewardUsdc,
        feeUsdc: '0',
        reference,
        txHash,
        description: 'Referral bonus — friend completed first transaction',
      });

      await this.referralRepo.update(
        { id: referral.id },
        {
          status: ReferralStatus.REWARDED,
          rewardUsdc,
          rewardedAt: new Date(),
        },
      );

      await this.notifService.create({
        userId: referral.referrerId,
        type: NotificationType.MONEY,
        title: '🎉 Referral Bonus!',
        body: `You earned $${REFERRAL_REWARD_USDC.toFixed(2)} USDC — your friend just made their first transaction!`,
        deepLink: '/earn',
      });

      this.logger.log(
        `Referral reward credited on-chain: $${REFERRAL_REWARD_USDC} → ${referral.referrerId} (txHash=${txHash})`,
      );
    } catch (err) {
      // USDC already sent on-chain — log critical for manual reconciliation
      this.logger.error(
        `CRITICAL: Referral bonus sent on-chain (txHash=${txHash}) but DB update failed for referral ${referral.id}: ${(err as Error).message}`,
      );
    }
  }

  // ── Code helper ───────────────────────────────────────────
  private generateReferralCode(user: User): string {
    // Use the unique random code generated at signup and stored on the user
    // row.  Falls back to username (uppercased) only for legacy accounts that
    // predate the referralCode column.
    return user.referralCode ?? user.username.toUpperCase();
  }
}
