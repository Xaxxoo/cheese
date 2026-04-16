// src/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) {}

  // ── GET /notifications ────────────────────────────────────
  async getNotifications(userId: string): Promise<Notification[]> {
    return this.notifRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  // ── POST /notifications/read ──────────────────────────────
  async markAllRead(userId: string): Promise<void> {
    await this.notifRepo.update({ userId, read: false }, { read: true });
  }

  // ── Internal: create a notification ──────────────────────
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    deepLink?: string;
  }): Promise<Notification> {
    return this.notifRepo.save(this.notifRepo.create(params));
  }

  // ── Internal: send money received notification ────────────
  async notifyMoneyReceived(
    userId: string,
    amountUsdc: string,
    senderName: string,
  ) {
    return this.create({
      userId,
      type: NotificationType.MONEY,
      title: 'Money Received',
      body: `You received $${parseFloat(amountUsdc).toFixed(2)} USDC from ${senderName}`,
      deepLink: '/history',
    });
  }

  async notifyTransactionComplete(
    userId: string,
    reference: string,
    amountUsdc: string,
  ) {
    return this.create({
      userId,
      type: NotificationType.MONEY,
      title: 'Transfer Complete',
      body: `Your transfer of $${parseFloat(amountUsdc).toFixed(2)} USDC was successful`,
      deepLink: `/history/${reference}`,
    });
  }

  async notifySecurityEvent(userId: string, event: string) {
    return this.create({
      userId,
      type: NotificationType.SECURITY,
      title: 'Security Alert',
      body: event,
      deepLink: '/profile/devices',
    });
  }

  // ── Waitlist notifications ────────────────────────────────

  async notifyReferralJoined(referrerId: string, referredUsername: string) {
    return this.create({
      userId: referrerId,
      type: NotificationType.REFERRAL_JOINED,
      title: 'New Referral!',
      body: `@${referredUsername} joined using your referral link. You earned 20 points!`,
      deepLink: '/waitlist/points',
    });
  }

  async notifyPointsAwarded(userId: string, points: number, reason: string) {
    return this.create({
      userId,
      type: NotificationType.POINTS_AWARDED,
      title: 'Points Awarded!',
      body: `You earned ${points} points for ${reason}`,
      deepLink: '/waitlist/points',
    });
  }

  async notifyMilestoneReached(userId: string, milestone: string) {
    return this.create({
      userId,
      type: NotificationType.MILESTONE_REACHED,
      title: 'Milestone Unlocked!',
      body: `Congratulations! You've reached: ${milestone}`,
      deepLink: '/leaderboard',
    });
  }

  async notifyLaunchAnnouncement(userId: string, message: string) {
    return this.create({
      userId,
      type: NotificationType.LAUNCH_ANNOUNCEMENT,
      title: 'Launch Update',
      body: message,
      deepLink: '/waitlist',
    });
  }

  async notifyLeaderboardUpdate(
    userId: string,
    newRank: number,
    oldRank: number,
  ) {
    const direction = newRank < oldRank ? 'up' : 'down';
    return this.create({
      userId,
      type: NotificationType.LEADERBOARD_UPDATE,
      title: `Rank ${direction}!`,
      body: `Your leaderboard position changed from #${oldRank} to #${newRank}`,
      deepLink: '/leaderboard',
    });
  }

  async notifyAccountFlagged(userId: string, reason: string) {
    return this.create({
      userId,
      type: NotificationType.SECURITY,
      title: 'Account Flagged',
      body: `Your account has been flagged: ${reason}. Please contact support.`,
      deepLink: '/profile',
    });
  }

  async notifyShareVerified(userId: string, platform: string, points: number) {
    return this.create({
      userId,
      type: NotificationType.POINTS_AWARDED,
      title: 'Share Verified!',
      body: `Your ${platform} share was verified. You earned ${points} points!`,
      deepLink: '/waitlist/points',
    });
  }
}
