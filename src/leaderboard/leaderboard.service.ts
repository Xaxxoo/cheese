// src/leaderboard/leaderboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WaitlistEntry } from '../waitlist/entities/waitlist-entry.entity';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly waitlistRepo: Repository<WaitlistEntry>,
  ) {}

  async getTopUsers(limit: number = 100) {
    const entries = await this.waitlistRepo
      .createQueryBuilder('waitlist')
      .select(['waitlist.username', 'waitlist.points'])
      .orderBy('waitlist.points', 'DESC')
      // .addOrderBy('waitlist.createdAt', 'ASC')
      .limit(limit)
      .getMany();

    const total = await this.waitlistRepo.count();

    return {
      entries: entries.map((entry, index) => ({
        rank: index + 1,
        username: entry.username,
        points: entry.points,
        joinDate: entry.createdAt,
      })),
      total,
    };
  }

  async getUserRank(username: string) {
    const entry = await this.waitlistRepo.findOne({
      where: { username },
      select: ['id', 'points', 'createdAt'],
    });

    if (!entry) return null;

    const higherCount = await this.waitlistRepo
      .createQueryBuilder('w')
      .where('w.points > :points', { points: entry.points })
      .orWhere('w.points = :points AND w.createdAt < :createdAt', {
        points: entry.points,
        // createdAt: entry.createdAt,
      })
      .getCount();

    return {
      rank: higherCount + 1,
      points: entry.points,
    };
  }
}