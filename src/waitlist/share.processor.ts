import { Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import {
  ShareEvent,
  SharePlatform,
  PLATFORM_POINTS,
} from './entities/share-event.entity';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
@Processor('share-tracking')
export class ShareProcessor extends WorkerHost {
  private readonly logger = new Logger(ShareProcessor.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(WaitlistEntry)
    private readonly waitlistRepo: Repository<WaitlistEntry>,
    @InjectRepository(ShareEvent)
    private readonly shareRepo: Repository<ShareEvent>,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { shareEventId, userId, platform, sharerType } = job.data as {
      shareEventId: string;
      userId: string;
      platform: SharePlatform;
      sharerType: string;
    };

    try {
      // Simulate share verification (in real app, this would check social media APIs)
      const isVerified = Math.random() > 0.1; // 90% success rate for demo

      const shareEvent = await this.shareRepo.findOne({
        where: { id: shareEventId },
        relations: sharerType === 'user' ? ['user'] : ['waitlistEntry'],
      });

      if (!shareEvent) {
        this.logger.warn(`Share event ${shareEventId} not found`);
        return;
      }

      if (isVerified) {
        const points = PLATFORM_POINTS[platform] ?? 0;
        shareEvent.verified = true;
        shareEvent.pointsAwarded = points;

        // Save share event first
        await this.shareRepo.save(shareEvent);

        // Update points based on sharer type
        if (sharerType === 'user' && shareEvent.user) {
          // Update registered user points
          await this.userRepo
            .createQueryBuilder('user')
            .update(User)
            .set({ points: () => `points + ${points}` })
            .where('id = :userId', { userId: shareEvent.user.id })
            .execute();

          // Notify user of points awarded
          this.notificationsService
            .notifyShareVerified(shareEvent.user.id, platform, points)
            .catch(() => {});
        } else if (sharerType === 'waitlist' && shareEvent.waitlistEntry) {
          // Update waitlist user points
          await this.waitlistRepo
            .createQueryBuilder('waitlist')
            .update(WaitlistEntry)
            .set({ points: () => `points + ${points}` })
            .where('id = :waitlistId', {
              waitlistId: shareEvent.waitlistEntry.id,
            })
            .execute();

          // Note: Waitlist users don't get notifications until they sign up
        }
      } else {
        shareEvent.verified = false;
        shareEvent.pointsAwarded = 0;
        await this.shareRepo.save(shareEvent);
      }

      this.logger.log(
        `Share verification completed for ${sharerType} ${userId} on ${platform}`,
      );
    } catch (error) {
      this.logger.error(`Share verification failed for job ${job.id}`, error);
      throw error;
    }
  }
}
