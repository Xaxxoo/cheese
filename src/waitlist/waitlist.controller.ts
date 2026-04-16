import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiQuery,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { WaitlistService } from './waitlist.service';
import { CheckUsernameDto, RegisterDto, ShareDto } from './dto/waitlist.dto';

@ApiTags('Waitlist')
@UseGuards(ThrottlerGuard)
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register for waitlist' })
  @ApiBody({
    type: RegisterDto,
    examples: {
      basic: {
        value: {
          email: 'user@example.com',
          username: 'john_doe',
        },
      },
      withReferral: {
        value: {
          email: 'user@example.com',
          username: 'jane_smith',
          referralCode: 'abc12345',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'user@example.com',
          username: 'john_doe',
          referralCode: 'abc12345',
          points: 0,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        referralLink: 'https://cheesepay.xyz/waitlist?ref=abc12345',
      },
    },
  })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.waitlistService.register(dto, this.getIp(req));
  }

  @Get('check-username')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Check if username is available' })
  @ApiQuery({
    name: 'username',
    required: true,
    description: 'Username to check (3-20 chars, alphanumeric + underscore)',
    example: 'john_doe',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: { available: true },
    },
  })
  checkUsername(@Query() q: CheckUsernameDto) {
    return this.waitlistService.checkUsername(q.username);
  }

  @Post('share')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track social share for bonus points' })
  @ApiBody({
    type: ShareDto,
    examples: {
      twitter: {
        value: {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          platform: 'twitter',
        },
      },
      linkedin: {
        value: {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          platform: 'linkedin',
        },
      },
      whatsapp: {
        value: {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          platform: 'whatsapp',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        pointsAwarded: 10,
        totalPoints: 15,
        platform: 'twitter',
      },
    },
  })
  trackShare(@Body() dto: ShareDto, @Req() req: Request) {
    const userAgent = req.headers['user-agent'] || '';
    return this.waitlistService.trackShare(dto, this.getIp(req), userAgent);
  }

  @Get('count')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Get total count of reserved usernames' })
  @ApiResponse({
    status: 200,
    schema: {
      example: { count: 2847 },
    },
  })
  getTotalReservedCount() {
    return this.waitlistService.getTotalReservedUsernames();
  }

  @Get('referral/:code')
  @Public()
  @ApiOperation({ summary: 'Get referral information by code' })
  @ApiParam({
    name: 'code',
    description: 'Referral code (8 characters)',
    example: 'abc12345',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        referrer: {
          username: 'john_doe',
          points: 100,
        },
        joinedCount: 5,
      },
    },
  })
  getReferralInfo(@Param('code') code: string) {
    return this.waitlistService.getReferralInfo(code);
  }

  @Get('points/:userId')
  @Public()
  @ApiOperation({ summary: 'Get user points and rank' })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        points: 150,
        rank: 12,
      },
    },
  })
  getUserPoints(
    @Param('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Disable caching to ensure fresh points data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    return this.waitlistService.getUserPoints(userId);
  }

  private getIp(req: Request): string {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      const first = Array.isArray(xff) ? xff[0] : xff;
      return first.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || req.ip || 'unknown';
  }
}
