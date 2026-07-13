// src/bills/bills.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Device } from '../devices/entities/device.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { RatesModule } from '../rates/rates.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';
import { FlutterwaveBillsClient } from './flutterwave-bills.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Device]),
    BlockchainModule,
    RatesModule,
    TransactionsModule,
    NotificationsModule,
  ],
  controllers: [BillsController],
  providers: [BillsService, FlutterwaveBillsClient],
})
export class BillsModule {}
