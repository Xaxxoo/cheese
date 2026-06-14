// src/banks/banks.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { User } from '../auth/entities/user.entity';
import { Device } from '../devices/entities/device.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { RatesModule } from '../rates/rates.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { BanksController } from './banks.controller';
import { BanksService } from './banks.service';
import { BanksScheduler } from './banks.scheduler';
import { BankTransferProcessor } from './bank-transfer.processor';
import { PulseMfbClient } from './pulsemfb.client';
import { BankTransfer } from './entities/bank-transfer.entity';
import { KycModule } from '../kyc/kyc.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AlertsModule } from '../alerts/alerts.module';
import { ReferralModule } from '../referral/referral.module';

const redisAvailable = !!(process.env.REDIS_URL || process.env.REDIS_HOST);

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Device, BankTransfer]),
    // Only register the queue when Redis is available — matches the pattern
    // used by AuthModule for the wallet-creation queue.
    ...(redisAvailable
      ? [BullModule.registerQueue({ name: 'bank-transfer' })]
      : []),
    BlockchainModule,
    RatesModule,
    TransactionsModule,
    KycModule,
    EmailModule,
    NotificationsModule,
    AlertsModule,
    ReferralModule,
  ],
  controllers: [BanksController],
  providers: [
    BanksService,
    BanksScheduler,
    PulseMfbClient,
    // Only register the processor when Redis is available — the @Processor
    // decorator tries to connect to the queue at startup and crashes without it.
    ...(redisAvailable ? [BankTransferProcessor] : []),
  ],
  exports: [BanksService],
})
export class BanksModule {}
