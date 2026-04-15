// src/kyc/tier-milestone.service.ts
//
// Called after every completed outbound transaction.
// Checks whether the user has hit a tier upgrade milestone and, if so,
// fires a one-time eligibility email with a CTA to complete the next KYC step.

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Tier } from '../auth/entities/user.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { EmailService } from '../email/email.service';
import { TIER_MILESTONES } from './tier.limits';

@Injectable()
export class TierMilestoneService {
  private readonly logger = new Logger(TierMilestoneService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly txService: TransactionsService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Call this after any completed outbound transaction.
   * Runs async — never throws, never blocks the caller.
   */
  async checkAndNotify(userId: string): Promise<void> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) return;

      const { totalUsdc, txCount } = await this.txService.getLifetimeOutboundStats(userId);

      if (user.tier === Tier.SILVER && !user.goldEligibleAt) {
        const { volumeUsdc, txCount: txTarget } = TIER_MILESTONES.silverToGold;
        if (totalUsdc >= volumeUsdc || txCount >= txTarget) {
          await this.userRepo.update(userId, { goldEligibleAt: new Date() });
          await this.emailService.sendTierEligible({
            to:          user.email,
            fullName:    user.fullName ?? user.username,
            currentTier: Tier.SILVER,
            nextTier:    Tier.GOLD,
            kycStep:     'selfie face-match',
          });
          this.logger.log(`Gold eligibility email sent [userId=${userId}] [volume=${totalUsdc}] [txCount=${txCount}]`);
        }
      }

      if (user.tier === Tier.GOLD && !user.blackEligibleAt) {
        const { volumeUsdc, txCount: txTarget } = TIER_MILESTONES.goldToBlack;
        if (totalUsdc >= volumeUsdc || txCount >= txTarget) {
          await this.userRepo.update(userId, { blackEligibleAt: new Date() });
          await this.emailService.sendTierEligible({
            to:          user.email,
            fullName:    user.fullName ?? user.username,
            currentTier: Tier.GOLD,
            nextTier:    Tier.BLACK,
            kycStep:     'document verification',
          });
          this.logger.log(`Black eligibility email sent [userId=${userId}] [volume=${totalUsdc}] [txCount=${txCount}]`);
        }
      }
    } catch (err) {
      // Never let milestone checks affect the transaction flow
      this.logger.warn(`Milestone check failed [userId=${userId}]: ${(err as Error).message}`);
    }
  }
}
