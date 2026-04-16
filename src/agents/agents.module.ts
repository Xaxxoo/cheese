import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentsProcessor } from './agents.processor';
import { User } from '../auth/entities/user.entity';
import { ShareEvent } from '../waitlist/entities/share-event.entity';
import { NotificationsModule } from '../notifications/notifications.module';

const redisAvailable = !!(process.env.REDIS_URL || process.env.REDIS_HOST);

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ShareEvent]),
    ...(redisAvailable
      ? [BullModule.registerQueue({ name: 'fraud-analysis' })]
      : []),
    NotificationsModule,
  ],
  controllers: [AgentsController],
  providers: [AgentsService, ...(redisAvailable ? [AgentsProcessor] : [])],
  exports: [AgentsService],
})
export class AgentsModule {}
