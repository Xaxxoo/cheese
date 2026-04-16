// src/leaderboard/leaderboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { WaitlistEntry } from '../waitlist/entities/waitlist-entry.entity';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(WaitlistEntry)
    private readonly waitlistRepo: Repository<WaitlistEntry>,
  ) {}

  async getTopUsers(limit: number = 100) {
    type RawEntry = { username: string; points: number; createdAt: string };

    // Fetch top users from both tables in parallel
    const [userEntries, waitlistEntries] = await Promise.all([
      this.userRepo
        .createQueryBuilder('user')
        .select([
          'user.username AS username',
          'user.points AS points',
          'user.createdAt AS createdAt',
          'true AS isUser',
        ])
        .where('user.points > 0')
        .orderBy('user.points', 'DESC')
        .limit(limit)
        .getRawMany<RawEntry>(),
      this.waitlistRepo
        .createQueryBuilder('waitlist')
        .select([
          'waitlist.username AS username',
          'waitlist.points AS points',
          'waitlist.createdAt AS createdAt',
          'false AS isUser',
        ])
        .where('waitlist.points > 0')
        .orderBy('waitlist.points', 'DESC')
        .limit(limit)
        .getRawMany<RawEntry>(),
    ]);

    // Merge and sort combined results
    const combined = [...userEntries, ...waitlistEntries]
      .sort(
        (a, b) =>
          b.points - a.points ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .slice(0, limit);

    // Get total count in parallel
    const [userCount, waitlistCount] = await Promise.all([
      this.userRepo.count(),
      this.waitlistRepo.count(),
    ]);

    return {
      entries: combined.map((entry, index) => ({
        rank: index + 1,
        username: entry.username,
        points: entry.points,
        joinDate: entry.createdAt,
      })),
      total: userCount + waitlistCount,
    };
  }

  async getUserRank(userId: string) {
    // Check if user is registered or in waitlist
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['points', 'createdAt'],
    });
    const entry =
      user ||
      (await this.waitlistRepo.findOne({
        where: { id: userId },
        select: ['points', 'createdAt'],
      }));

    if (!entry) return null;

    // Count entries in BOTH tables with higher points
    const [higherUsers, higherWaitlist] = await Promise.all([
      this.userRepo
        .createQueryBuilder('u')
        .where('u.points > :points', { points: entry.points })
        .orWhere('(u.points = :points AND u.createdAt < :createdAt)', {
          points: entry.points,
          createdAt: entry.createdAt,
        })
        .getCount(),
      this.waitlistRepo
        .createQueryBuilder('w')
        .where('w.points > :points', { points: entry.points })
        .orWhere('(w.points = :points AND w.createdAt < :createdAt)', {
          points: entry.points,
          createdAt: entry.createdAt,
        })
        .getCount(),
    ]);

    return {
      rank: higherUsers + higherWaitlist + 1,
      points: entry.points,
    };
  }
}
