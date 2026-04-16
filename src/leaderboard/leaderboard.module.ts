import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { User } from '../auth/entities/user.entity';
import { WaitlistEntry } from '../waitlist/entities/waitlist-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, WaitlistEntry])],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
