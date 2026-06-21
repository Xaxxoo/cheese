// src/notifications/notifications.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { NotificationsService } from './notifications.service';

class SubscribeDto {
  @IsString()
  endpoint: string;

  @IsString()
  p256dh: string;

  @IsString()
  authKey: string;
}

class UnsubscribeDto {
  @IsString()
  endpoint: string;
}

class ExpoTokenDto {
  @IsString()
  token: string;
}

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get notifications',
    description:
      'Returns the last 50 in-app notifications for the authenticated user, ordered newest first. Includes read/unread status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of notifications (max 50, newest first)',
  })
  getAll(@CurrentUser() user: User) {
    return this.notifService.getNotifications(user.id);
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description:
      'Bulk-marks every unread notification as read. Use after the user opens the notification centre.',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read — returns updated count',
  })
  markRead(@CurrentUser() user: User) {
    return this.notifService.markAllRead(user.id);
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subscribe to push notifications' })
  @ApiResponse({ status: 200, description: 'Subscription saved' })
  subscribe(@CurrentUser() user: User, @Body() dto: SubscribeDto) {
    return this.notifService.subscribe(user.id, dto.endpoint, dto.p256dh, dto.authKey);
  }

  @Delete('subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsubscribe from push notifications' })
  @ApiResponse({ status: 204, description: 'Subscription removed' })
  async unsubscribe(@CurrentUser() user: User, @Body() dto: UnsubscribeDto): Promise<void> {
    await this.notifService.unsubscribe(user.id, dto.endpoint);
  }

  @Post('expo-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register Expo push token for native mobile' })
  @ApiResponse({ status: 200, description: 'Token registered' })
  registerExpoToken(@CurrentUser() user: User, @Body() dto: ExpoTokenDto) {
    return this.notifService.upsertExpoToken(user.id, dto.token);
  }

  @Delete('expo-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove Expo push token' })
  @ApiResponse({ status: 204, description: 'Token removed' })
  async removeExpoToken(@CurrentUser() user: User, @Body() dto: ExpoTokenDto): Promise<void> {
    await this.notifService.removeExpoToken(user.id, dto.token);
  }
}
