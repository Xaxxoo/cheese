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
    const qualified = referrals.filter(
      (r) => r.status === ReferralStatus.QUALIFIED,
    ).length;
    const rewarded = referrals.filter(
      (r) => r.status === ReferralStatus.REWARDED,
    );
    const totalEarned = rewarded.reduce(
      (sum, r) => sum + parseFloat(r.rewardUsdc || '0'),
      0,
    );

    const referralCode = this.generateReferralCode(user);
    const referralUrl = `https://cheesepay.xyz/join?ref=${referralCode}`;

    return {
      referralCode,
      referralUrl,
      stats: {
        totalReferrals: referrals.length,
        pending,
        qualified,
        rewarded: rewarded.length,
        totalEarned: totalEarned.toFixed(6),
        rewardPerRef: String(REFERRAL_REWARD_USDC),
      },
      recentReferrals: referrals.slice(0, 5).map((r) => ({
        id: r.id,
        status: r.status,
        rewardUsdc: r.rewardUsdc,
        createdAt: r.createdAt,
        rewardedAt: r.rewardedAt,
      })),
    };
  }

  // ── Internal: link referral on signup ─────────────────────
  async linkReferral(refereeId: string, referralCode: string): Promise<void> {
    // Decode code → referrer username
    const referrerUsername = this.decodeReferralCode(referralCode);
    if (!referrerUsername) return;

    const referrer = await this.userRepo.findOne({
      where: { username: referrerUsername },
    });
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
      relations: ['referrer'],
    });

    if (!referral) return;

    await this.referralRepo.update(
      { id: referral.id },
      { status: ReferralStatus.QUALIFIED },
    );

    // Credit reward to referrer
    await this.creditReward(referral);
  }

  // ── Private: credit USDC reward ───────────────────────────
  private async creditReward(referral: Referral): Promise<void> {
    try {
      const rewardUsdc = String(REFERRAL_REWARD_USDC);
      const reference = `CW-REF-${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

      await this.txService.create({
        userId: referral.referrerId,
        type: TxType.REFERRAL_BONUS,
        status: TxStatus.COMPLETED,
        amountUsdc: rewardUsdc,
        feeUsdc: '0',
        reference,
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
        `Referral reward credited: $${REFERRAL_REWARD_USDC} → ${referral.referrerId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to credit referral reward: ${(err as Error).message}`,
      );
    }
  }

  // ── Code helpers ─────────────────────────────────────────
  private generateReferralCode(user: User): string {
    // Simple, readable code: username in uppercase
    // Could swap for a short hash in production for obfuscation
    return user.username.toUpperCase();
  }

  private decodeReferralCode(code: string): string | null {
    if (!code || code.length < 3) return null;
    return code.toLowerCase(); // maps back to username
  }
}
