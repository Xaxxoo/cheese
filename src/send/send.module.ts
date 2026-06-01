// src/send/send.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Device } from '../devices/entities/device.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { RatesModule } from '../rates/rates.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { SendController } from './send.controller';
import { SendService } from './send.service';
import { KycModule } from '../kyc/kyc.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Device]),
    BlockchainModule,
    RatesModule,
    TransactionsModule,
    KycModule,
    EmailModule,
    NotificationsModule,
  ],
  controllers: [SendController],
  providers: [SendService],
})
export class SendModule {}
