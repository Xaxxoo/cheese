// src/notifications/notifications.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { Notification, NotificationType } from './entities/notification.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { ExpoPushToken } from './entities/expo-push-token.entity';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly expo = new Expo();

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(PushSubscription)
    private readonly pushSubRepo: Repository<PushSubscription>,
    @InjectRepository(ExpoPushToken)
    private readonly expoTokenRepo: Repository<ExpoPushToken>,
  ) {}

  private readonly logger = new Logger(NotificationsService.name);

  onModuleInit() {
    if (
      process.env.VAPID_SUBJECT &&
      process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY
    ) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
      );
    } else {
      this.logger.warn(
        'VAPID env vars not set — push notifications disabled. ' +
          'Set VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY to enable.',
      );
    }
  }

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

  // ── POST /notifications/subscribe ────────────────────────
  async subscribe(
    userId: string,
    endpoint: string,
    p256dh: string,
    authKey: string,
  ): Promise<void> {
    await this.pushSubRepo.upsert(
      { userId, endpoint, p256dh, authKey },
      { conflictPaths: ['endpoint'] },
    );
  }

  // ── DELETE /notifications/subscribe ──────────────────────
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.pushSubRepo.delete({ userId, endpoint });
  }

  // ── POST /notifications/expo-token ────────────────────────
  async upsertExpoToken(userId: string, token: string): Promise<void> {
    await this.expoTokenRepo.upsert(
      { userId, token },
      { conflictPaths: ['token'] },
    );
  }

  // ── DELETE /notifications/expo-token ─────────────────────
  async removeExpoToken(userId: string, token: string): Promise<void> {
    await this.expoTokenRepo.delete({ userId, token });
  }

  // ── Internal: fire-and-forget push to all user devices ───
  private async sendPush(
    userId: string,
    title: string,
    body: string,
    url: string,
  ): Promise<void> {
    // ── Web Push (PWA) ──
    if (process.env.VAPID_PUBLIC_KEY) {
      const subs = await this.pushSubRepo.find({ where: { userId } });
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.authKey } },
            JSON.stringify({ title, body, url, tag: 'cheese-notification' }),
          );
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await this.pushSubRepo.delete({ id: sub.id });
          }
        }
      }
    }

    // ── Expo Push (native mobile) ──
    const expoTokens = await this.expoTokenRepo.find({ where: { userId } });
    const validTokens = expoTokens.filter((t) => Expo.isExpoPushToken(t.token));
    if (!validTokens.length) return;

    const messages: ExpoPushMessage[] = validTokens.map((t) => ({
      to: t.token,
      title,
      body,
      data: { url },
      sound: 'default' as const,
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets: ExpoPushTicket[] =
          await this.expo.sendPushNotificationsAsync(chunk);
        // Remove tokens that the Expo service reports as invalid
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (
            ticket.status === 'error' &&
            ticket.details?.error === 'DeviceNotRegistered'
          ) {
            await this.expoTokenRepo.delete({ token: messages[i].to as string });
          }
        }
      } catch (err) {
        this.logger.error('Expo push send error', err);
      }
    }
  }

  // ── Internal: create a notification ──────────────────────
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    deepLink?: string;
  }): Promise<Notification> {
    const notification = await this.notifRepo.save(this.notifRepo.create(params));
    void this.sendPush(
      params.userId,
      params.title,
      params.body,
      params.deepLink ?? '/notifications',
    );
    return notification;
  }

  // ── Internal: send money received notification ────────────
  async notifyKycVerified(userId: string, tier: string) {
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
    return this.create({
      userId,
      type: NotificationType.KYC_VERIFIED,
      title: 'Identity Verified',
      body: `Your identity has been verified. You're now on the ${tierLabel} tier with full access to all features.`,
      deepLink: '/profile',
    });
  }

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

  async notifyBankTransferFailed(
    userId: string,
    amountNgn: string,
    reason: string,
  ) {
    return this.create({
      userId,
      type: NotificationType.MONEY,
      title: 'Withdrawal Failed — USDC Refunded',
      body: `Your ₦${parseFloat(amountNgn).toLocaleString()} withdrawal could not be completed. Your USDC has been refunded to your wallet. Reason: ${reason}`,
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
