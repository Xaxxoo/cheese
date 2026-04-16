import { Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { ShareEvent } from '../waitlist/entities/share-event.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
@Processor('fraud-analysis')
export class AgentsProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentsProcessor.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ShareEvent)
    private readonly shareRepo: Repository<ShareEvent>,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    const { userId, shareEventId } = job.data as {
      userId: string;
      shareEventId: string;
    };

    try {
      if (job.name === 'analyze-registration') {
        return await this.analyzeRegistration(userId);
      } else if (job.name === 'analyze-share') {
        return await this.analyzeShare(shareEventId);
      }

      this.logger.warn(`Unknown job type: ${job.name}`);
      return { risk: 'unknown', score: 0, reasons: [] };
    } catch (error) {
      this.logger.error(`Analysis failed for job ${job.id}`, error);
      throw error;
    }
  }

  private async analyzeRegistration(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return { risk: 'unknown', score: 0, reasons: [] };

    let riskScore = 0;
    const reasons: string[] = [];

    // Check IP address patterns
    const recentUsersFromIP = await this.userRepo
      .createQueryBuilder('u')
      .where('u.ipAddress = :ip', { ip: user.ipAddress })
      .andWhere('u.createdAt > :recent', {
        recent: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .getCount();

    if (recentUsersFromIP > 5) {
      riskScore += 30;
      reasons.push('Multiple registrations from same IP in 24h');
    }

    // Check username patterns
    if (/\d{4,}/.test(user.username)) {
      riskScore += 20;
      reasons.push('Username contains many numbers');
    }

    // Check email domain
    const disposableDomains = [
      '10minutemail.com',
      'temp-mail.org',
      'guerrillamail.com',
    ];
    const emailDomain = user.email.split('@')[1];
    if (disposableDomains.includes(emailDomain)) {
      riskScore += 50;
      reasons.push('Disposable email domain');
    }

    // Check referral patterns
    if (!user.referredBy) {
      riskScore += 10;
      reasons.push('No referral source');
    }

    let risk = 'low';
    if (riskScore >= 50) risk = 'high';
    else if (riskScore >= 20) risk = 'medium';

    // Flag user if high risk
    if (riskScore >= 30) {
      user.isFlagged = true;
      await this.userRepo.save(user);

      this.notificationsService
        .notifyAccountFlagged(
          user.id,
          `Suspicious registration activity detected. Risk: ${risk}, Score: ${riskScore}`,
        )
        .catch(() => {});
      this.logger.warn(
        `User ${user.username} flagged for fraud: ${reasons.join(', ')}`,
      );
    }

    return { risk, score: riskScore, reasons };
  }

  private async analyzeShare(shareEventId: string) {
    const share = await this.shareRepo.findOne({
      where: { id: shareEventId },
      relations: ['user'],
    });
    if (!share) return { risk: 'unknown', score: 0, reasons: [] };

    let riskScore = 0;
    const reasons: string[] = [];

    // Check share frequency
    const recentShares = await this.shareRepo
      .createQueryBuilder('s')
      .where('s.userId = :userId', { userId: share.userId })
      .andWhere('s.createdAt > :recent', {
        recent: new Date(Date.now() - 60 * 60 * 1000),
      })
      .getCount();

    if (recentShares > 10) {
      riskScore += 40;
      reasons.push('Excessive sharing activity');
    }

    // Check user agent patterns
    if (!share.userAgent || share.userAgent.includes('bot')) {
      riskScore += 30;
      reasons.push('Suspicious user agent');
    }

    let risk = 'low';
    if (riskScore >= 40) risk = 'high';
    else if (riskScore >= 20) risk = 'medium';

    // Mark as fraud if high risk
    if (riskScore >= 30) {
      share.isFraud = true;
      await this.shareRepo.save(share);

      // Only flag user if this is a registered user (not waitlist user)
      if (share.user) {
        share.user.isFlagged = true;
        await this.userRepo.save(share.user);

        this.notificationsService
          .notifyAccountFlagged(
            share.user.id,
            `Suspicious sharing activity detected. Risk: ${risk}, Score: ${riskScore}`,
          )
          .catch(() => {});
      }
      this.logger.warn(
        `Share ${shareEventId} marked as fraud: ${reasons.join(', ')}`,
      );
    }

    return { risk, score: riskScore, reasons };
  }
}
