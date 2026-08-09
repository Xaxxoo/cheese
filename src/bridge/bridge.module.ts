// src/bridge/bridge.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Device } from '../devices/entities/device.entity';
import { BankTransfer } from '../banks/entities/bank-transfer.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BridgeController } from './bridge.controller';
import { BridgeService } from './bridge.service';
import { BridgeTransferService } from './bridge-transfer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Device, BankTransfer]),
    BlockchainModule,
    TransactionsModule,
    NotificationsModule,
  ],
  controllers: [BridgeController],
  providers: [BridgeService, BridgeTransferService],
  exports: [BridgeService],
})
export class BridgeModule {}
