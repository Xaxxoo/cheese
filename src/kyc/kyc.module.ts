// src/kyc/kyc.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { KycAttempt } from './entities/kyc-attempt.entity';
import { DojahClient } from './dojah.client';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { TierMilestoneService } from './tier-milestone.service';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycAttempt, User]),
    EmailModule,
    TransactionsModule,
    NotificationsModule,
  ],
  controllers: [KycController],
  providers: [KycService, DojahClient, TierMilestoneService],
  exports: [KycService, TierMilestoneService],
})
export class KycModule {}
