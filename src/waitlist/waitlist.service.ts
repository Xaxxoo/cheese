// src/waitlist/waitlist.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { User } from '../auth/entities/user.entity';
import { ShareEvent, PLATFORM_POINTS } from './entities/share-event.entity';
import {
  ReferralEvent,
  REFERRAL_POINTS,
} from './entities/referral-event.entity';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterDto, ShareDto } from './dto/waitlist.dto';
import {
  WaitlistEntry,
  WaitlistStatus,
} from './entities/waitlist-entry.entity';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { generateShortCode } from '../common/utils/random-code.util';

const RESERVED_USERNAMES = new Set([
  'admin',
  'cheese',
  'support',
  'help',
  'api',
  'www',
  'app',
  'mail',
  'official',
  'team',
  'staff',
  'moderator',
  'mod',
  'security',
  'legal',
  'billing',
  'payments',
  'wallet',
  'system',
  'root',
  'null',
  'undefined',
  'anonymous',
  'guest',
]);

const FIRST_REMINDER_DAYS = 7;
const SECOND_REMINDER_DAYS = 21;

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ShareEvent)
    private readonly shareRepo: Repository<ShareEvent>,
    @InjectRepository(ReferralEvent)
    private readonly referralRepo: Repository<ReferralEvent>,
    @InjectRepository(WaitlistEntry)
    private readonly entryRepo: Repository<WaitlistEntry>,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @Optional()
    @InjectQueue('share-tracking')
    private readonly shareQueue?: Queue,
    @Optional()
    @InjectQueue('fraud-detection')
    private readonly fraudQueue?: Queue,
  ) {}

  // ── Register ──────────────────────────────────────────────────────────────

  async register(dto: RegisterDto, ipAddress: string) {
    const { email, username, referralCode: incomingReferralCode } = dto;

    if (RESERVED_USERNAMES.has(username.toLowerCase())) {
      throw new ConflictException('This username is reserved');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const takenUsername = await queryRunner.manager.findOne(WaitlistEntry, {
        where: { username },
        lock: { mode: 'pessimistic_write' },
      });
      if (takenUsername)
        throw new ConflictException('This username is already reserved');

      const takenEmail = await queryRunner.manager.findOne(WaitlistEntry, {
        where: { email },
      });
      if (takenEmail)
        throw new ConflictException('This email is already on the waitlist');

      const userWithUsername = await queryRunner.manager.findOne(User, {
        where: { username, emailVerified: true },
      });
      if (userWithUsername)
        throw new ConflictException('This username is already taken');

      // ── Resolve referrer ──────────────────────────────────────────────────
      let referrerUser: User | null = null;
      let referrerWaitlist: WaitlistEntry | null = null;

      if (incomingReferralCode) {
        referrerUser = await queryRunner.manager.findOne(User, {
          where: { referralCode: incomingReferralCode },
        });

        if (!referrerUser) {
          referrerWaitlist = await queryRunner.manager.findOne(WaitlistEntry, {
            where: { referralCode: incomingReferralCode },
          });
        }
        // Silently ignore invalid codes — don't block registration
      }

      // ── Create entry ──────────────────────────────────────────────────────
      const totalEntries = await queryRunner.manager.count(WaitlistEntry);
      const position = totalEntries + 1;
      const generatedCode = generateShortCode(8);

      const newEntry = await queryRunner.manager.save(
        queryRunner.manager.create(WaitlistEntry, {
          email,
          username,
          status: WaitlistStatus.PENDING,
          referralSource: incomingReferralCode || null,
          referrerId: referrerUser?.id || referrerWaitlist?.id || null,
          referralCode: generatedCode,
          ipAddress,
          position,
        }),
      );

      // ── Award referral points ─────────────────────────────────────────────
      if (referrerUser) {
        await queryRunner.manager.increment(
          User,
          { id: referrerUser.id },
          'points',
          REFERRAL_POINTS,
        );
        await queryRunner.manager.save(
          queryRunner.manager.create(ReferralEvent, {
            referrerUserId: referrerUser.id,
            referredWaitlistId: newEntry.id,
            referredType: 'waitlist',
            pointsAwarded: REFERRAL_POINTS,
          }),
        );
        this.logger.log(
          `Referral points → user ${referrerUser.id} (+${REFERRAL_POINTS}pts)`,
        );
      } else if (referrerWaitlist) {
        await queryRunner.manager.increment(
          WaitlistEntry,
          { id: referrerWaitlist.id },
          'points',
          REFERRAL_POINTS,
        );
        await queryRunner.manager.save(
          queryRunner.manager.create(ReferralEvent, {
            referrerWaitlistId: referrerWaitlist.id,
            referredWaitlistId: newEntry.id,
            referredType: 'waitlist',
            pointsAwarded: REFERRAL_POINTS,
          }),
        );
        this.logger.log(
          `Referral points → waitlist ${referrerWaitlist.id} (+${REFERRAL_POINTS}pts)`,
        );
      }

      await queryRunner.commitTransaction();

      // ── Fire-and-forget: confirmation email ───────────────────────────────
      this.emailService
        .sendWaitlistConfirmation({
          to: newEntry.email,
          username: newEntry.username,
          position: newEntry.position ?? undefined,
          // ← referralCode intentionally omitted — not part of the template interface
        })
        .then(() =>
          this.entryRepo.update(newEntry.id, { notifiedAt: new Date() }),
        )
        .catch((err) =>
          this.logger.error('Waitlist confirmation email failed', err),
        );

      const frontendUrl = this.config.get<string>(
        'app.frontendUrl',
        'https://cheesepay.xyz',
      );
      const referralLink = `${frontendUrl}/waitlist?ref=${newEntry.referralCode}`;

      return {
        user: {
          id: newEntry.id,
          email: newEntry.email,
          username: newEntry.username,
          referralCode: newEntry.referralCode,
          points: newEntry.points,
          createdAt: newEntry.createdAt.toISOString(),
        },
        referralLink,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Track Share ───────────────────────────────────────────────────────────

  async trackShare(dto: ShareDto, ipAddress: string, userAgent: string) {
    const { userId, platform } = dto;

    // First check if this is a registered user
    let user: User | null = null;
    let waitlistEntry: WaitlistEntry | null = null;
    let sharerType: 'user' | 'waitlist' = 'waitlist';

    user = await this.userRepo.findOne({ where: { id: userId } });
    if (user) {
      sharerType = 'user';
    } else {
      // Check if this is a waitlist user
      waitlistEntry = await this.entryRepo.findOne({ where: { id: userId } });
      if (!waitlistEntry) {
        throw new NotFoundException('User not found');
      }
      sharerType = 'waitlist';
    }

    // Check if account is flagged (only applies to registered users)
    if (user && user.isFlagged) {
      throw new BadRequestException(
        'Account is flagged. Please contact support.',
      );
    }

    // Max 1 share per platform per user per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alreadyShared = await this.shareRepo
      .createQueryBuilder('se')
      .where(
        sharerType === 'user'
          ? 'se.userId = :userId'
          : 'se.waitlistId = :waitlistId',
        sharerType === 'user' ? { userId } : { waitlistId: userId },
      )
      .andWhere('se.platform = :platform', { platform })
      .andWhere('se.createdAt >= :today', { today })
      .andWhere('se.isFraud = :fraud', { fraud: false })
      .getOne();

    if (alreadyShared) {
      throw new ConflictException(
        `You have already shared on ${platform} today. Come back tomorrow!`,
      );
    }

    const shareEvent = this.shareRepo.create({
      userId: sharerType === 'user' ? userId : null,
      waitlistId: sharerType === 'waitlist' ? userId : null,
      sharerType,
      platform,
      verified: false,
      pointsAwarded: 0,
      ipAddress,
      userAgent,
      isFraud: false,
    });
    await this.shareRepo.save(shareEvent);

    // For development: award points synchronously instead of queuing
    const points = PLATFORM_POINTS[platform] ?? 0;

    if (points > 0) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        if (sharerType === 'user') {
          await queryRunner.manager
            .createQueryBuilder()
            .update(User)
            .set({ points: () => `points + ${points}` })
            .where('id = :id', { id: userId })
            .execute();
        } else {
          await queryRunner.manager
            .createQueryBuilder()
            .update(WaitlistEntry)
            .set({ points: () => `points + ${points}` })
            .where('id = :id', { id: userId })
            .execute();
        }

        // Update share event as verified
        await queryRunner.manager.update(ShareEvent, shareEvent.id, {
          verified: true,
          pointsAwarded: points,
        });

        await queryRunner.commitTransaction();

        this.logger.log(
          `Share points awarded synchronously [${sharerType}=${userId}] [platform=${platform}] [points=${points}]`,
        );
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    }

    // Still add to queue for production processing (when Redis is available)
    if (this.shareQueue) {
      await this.shareQueue.add(
        'verify-share',
        { shareEventId: shareEvent.id, userId, platform, sharerType },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      );
    }

    if (this.fraudQueue) {
      this.fraudQueue
        .add(
          'check-share',
          { type: 'check-share', shareEventId: shareEvent.id, ipAddress },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        )
        .catch((err) => this.logger.error('Fraud queue error', err));
    }

    return {
      success: true,
      shareEventId: shareEvent.id,
      message: 'Share recorded and points awarded!',
      pendingPoints: points,
    };
  }

  // ── Check Username ────────────────────────────────────────────────────────

  async checkUsername(username: string) {
    if (RESERVED_USERNAMES.has(username.toLowerCase())) {
      return {
        available: false,
        username,
        reason: 'This username is reserved',
      };
    }

    const existingUser = await this.userRepo.findOne({ where: { username } });
    if (existingUser) {
      return {
        available: false,
        username,
        reason: 'Username is already taken',
      };
    }

    const existingEntry = await this.entryRepo.findOne({ where: { username } });
    if (existingEntry) {
      return {
        available: false,
        username,
        reason: 'Username is already reserved',
      };
    }

    return { available: true, username, reason: undefined };
  }

  // ── Referral Info ─────────────────────────────────────────────────────────

  async getReferralInfo(code: string) {
    const user = await this.userRepo.findOne({
      where: { referralCode: code },
      select: ['id', 'username', 'referralCode'],
    });
    if (user) {
      return {
        valid: true,
        referrerUsername: user.username,
        referralCode: user.referralCode,
      };
    }

    const waitlistEntry = await this.entryRepo.findOne({
      where: { referralCode: code },
      select: ['id', 'username', 'referralCode'],
    });
    if (waitlistEntry) {
      return {
        valid: true,
        referrerUsername: waitlistEntry.username,
        referralCode: waitlistEntry.referralCode,
      };
    }

    throw new NotFoundException('Referral code not found');
  }

  // ── Points ────────────────────────────────────────────────────────────────

  async getEntryByEmail(email: string): Promise<WaitlistEntry | null> {
    return this.entryRepo.findOne({ where: { email } });
  }

  async getUserPoints(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['points'],
    });
    if (!user) throw new NotFoundException('User not found');

    const shareCount = await this.shareRepo.count({
      where: { userId, verified: true },
    });
    const referralCount = await this.referralRepo.count({
      where: [{ referrerUserId: userId }, { referrerWaitlistId: userId }],
    });

    return {
      points: user.points,
      shareCount,
      referralCount,
      timestamp: new Date().toISOString(),
    };
  }

  async getTotalRegisteredUsers(): Promise<number> {
    return this.userRepo.count();
  }

  async getTotalReservedUsernames(): Promise<number> {
    const count = await this.entryRepo.count();
    this.logger.log(`Total reserved usernames: ${count}`);
    return count;
  }

  // ── Scheduled reminders ───────────────────────────────────────────────────

  @Cron('0 8 * * *', { timeZone: 'UTC' })
  async sendReminders(): Promise<void> {
    const appUrl = this.config.get<string>(
      'app.frontendUrl',
      'https://cheesepay.xyz',
    );
    const entries = await this.entryRepo.find({
      where: { status: WaitlistStatus.PENDING },
    });
    const now = new Date();

    for (const entry of entries) {
      const daysSinceJoined = Math.floor(
        (now.getTime() - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (
        daysSinceJoined !== FIRST_REMINDER_DAYS &&
        daysSinceJoined !== SECOND_REMINDER_DAYS
      ) {
        continue;
      }

      const signupUrl = `${appUrl}/signup?email=${encodeURIComponent(entry.email)}`;

      this.emailService
        .sendWaitlistReminder({
          to: entry.email,
          username: entry.username,
          signupUrl,
          daysOnList: daysSinceJoined,
          position: entry.position ?? undefined,
        })
        .then(() => {
          this.logger.log(
            `Reminder sent [email=${entry.email}] [day=${daysSinceJoined}]`,
          );
          return this.entryRepo.update(entry.id, { notifiedAt: new Date() });
        })
        .catch((err) =>
          this.logger.error(
            `Reminder failed [email=${entry.email}]: ${(err as Error).message}`,
          ),
        );
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildReferralLink(code: string): string {
    const base = this.config.get<string>(
      'app.frontendUrl',
      'https://cheesepay.xyz',
    );
    return `${base}/waitlist?ref=${code}`;
  }
}
