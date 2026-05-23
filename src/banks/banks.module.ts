// src/banks/banks.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Device } from '../devices/entities/device.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { RatesModule } from '../rates/rates.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { BanksController } from './banks.controller';
import { BanksService } from './banks.service';
import { BanksScheduler } from './banks.scheduler';
import { PulseMfbClient } from './pulsemfb.client';
import { BankTransfer } from './entities/bank-transfer.entity';
import { KycModule } from '../kyc/kyc.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Device, BankTransfer]),
    BlockchainModule,
    RatesModule,
    TransactionsModule,
    KycModule,
    EmailModule,
    NotificationsModule,
  ],
  controllers: [BanksController],
  providers: [BanksService, BanksScheduler, PulseMfbClient],
  exports: [BanksService],
})
export class BanksModule {}
