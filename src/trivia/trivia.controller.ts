import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { TriviaService } from './trivia.service';
import { SubmitRoundDto } from './dto/submit-round.dto';

@ApiTags('Trivia')
@Controller('trivia')
export class TriviaController {
  constructor(private readonly triviaService: TriviaService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Start a trivia round' })
  startRound(@CurrentUser() user: User) {
    return this.triviaService.startRound(user.id);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit answers for a trivia round' })
  submitRound(@CurrentUser() user: User, @Body() dto: SubmitRoundDto) {
    return this.triviaService.submitRound(user.id, dto);
  }

  @Get('leaderboard')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get weekly trivia leaderboard' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  getLeaderboard(@Query('limit') limit?: string) {
    return this.triviaService.getWeeklyLeaderboard(
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('stats')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get your trivia stats' })
  getMyStats(@CurrentUser() user: User) {
    return this.triviaService.getMyStats(user.id);
  }
}
