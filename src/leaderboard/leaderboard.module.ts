import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { WaitlistEntry } from '../waitlist/entities/waitlist-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ WaitlistEntry])],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}