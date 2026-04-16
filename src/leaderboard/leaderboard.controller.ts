import { Controller, Get, Query } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { Public } from 'src/common/decorators/public.decorator';

@Public()
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  getTopUsers(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 100;
    return this.leaderboardService.getTopUsers(limitNum);
  }

  @Get('rank')
  getUserRank(@Query('username') username: string) {
    return this.leaderboardService.getUserRank(username);
  }

  @Get('waitlist')
  getWaitlistLeaderboard(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 100;
    return this.leaderboardService.getTopUsers(limitNum);
  }

  @Get('waitlist/position')
  getWaitlistPosition(@Query('username') username: string) {
    return this.leaderboardService.getUserRank(username);
  }
}
