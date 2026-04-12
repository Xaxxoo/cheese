import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { ShareProcessor } from './share.processor';
import { FraudProcessor } from './fraud.processor';
import { User } from '../auth/entities/user.entity';
import { ShareEvent } from './entities/share-event.entity';
import { ReferralEvent } from './entities/referral-event.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AgentsModule } from '../agents/agents.module';

const redisAvailable = !!(process.env.REDIS_URL || process.env.REDIS_HOST);

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ShareEvent, ReferralEvent, WaitlistEntry]),
    ...(redisAvailable
      ? [
          BullModule.registerQueue(
            { name: 'share-tracking' },
            { name: 'fraud-detection' },
          ),
        ]
      : []),
    EmailModule,
    NotificationsModule,
    AgentsModule,
  ],
  controllers: [WaitlistController],
  providers: [
    WaitlistService,
    ...(redisAvailable ? [ShareProcessor, FraudProcessor] : []),
  ],
  exports: [WaitlistService],
})
export class WaitlistModule {}
