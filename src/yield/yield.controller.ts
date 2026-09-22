// src/yield/yield.controller.ts
import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { YieldService } from './yield.service';
import { YieldPoolScheduler } from './yield-pool.scheduler';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';

@ApiTags('Earn')
@ApiBearerAuth('access-token')
@Controller('yield')
export class YieldController {
  constructor(
    private readonly yieldService: YieldService,
    private readonly yieldPoolScheduler: YieldPoolScheduler,
  ) {}

  @Post('enroll')
  @ApiOperation({
    summary: 'Opt in to yield earning',
    description:
      'Enrolls the authenticated user in the yield program. Requires KYC verification and minimum USDC balance.',
  })
  @ApiResponse({ status: 201, description: 'Successfully enrolled' })
  @ApiResponse({ status: 400, description: 'KYC not verified or balance too low' })
  async enroll(@CurrentUser() user: User) {
    await this.yieldService.enroll(user.id);
    return { message: 'Successfully enrolled in yield' };
  }

  @Post('unenroll')
  @ApiOperation({
    summary: 'Opt out of yield earning',
    description: 'Unenrolls the authenticated user from the yield program.',
  })
  @ApiResponse({ status: 201, description: 'Successfully unenrolled' })
  async unenroll(@CurrentUser() user: User) {
    await this.yieldService.unenroll(user.id);
    return { message: 'Successfully unenrolled from yield' };
  }

  @Get('status')
  @ApiOperation({
    summary: 'Get yield status',
    description:
      'Returns the user\'s yield enrollment state, current APY rate for their tier, total earned, and last distribution date.',
  })
  @ApiResponse({
    status: 200,
    description:
      'enrolled, enrolledAt, tier, apyRate, totalEarned, lastDistributionAt, balanceUsdc',
  })
  getStatus(@CurrentUser() user: User) {
    return this.yieldService.getStatus(user.id);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get yield credit history',
    description:
      'Returns past yield credit transactions for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Paginated yield credit transactions' })
  getHistory(@CurrentUser() user: User) {
    return this.yieldService.getHistory(user.id);
  }

  @Post('admin/rebalance')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-token')
  @ApiOperation({
    summary: 'Manually trigger pool rebalance',
    description:
      'Admin-only endpoint that immediately triggers the yield pool rebalance cycle. Useful when liquidity issues are detected.',
  })
  @ApiResponse({ status: 201, description: 'Rebalance triggered' })
  @ApiResponse({ status: 401, description: 'Admin authentication required' })
  async adminRebalance() {
    await this.yieldPoolScheduler.rebalancePool();
    return { message: 'Pool rebalance triggered' };
  }
}
