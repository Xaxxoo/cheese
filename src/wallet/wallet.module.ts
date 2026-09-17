// src/wallet/wallet.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { RatesModule } from '../rates/rates.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AlertsModule } from '../alerts/alerts.module';
import { User } from '../auth/entities/user.entity';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WalletDepositScheduler } from './wallet.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    BlockchainModule,
    RatesModule,
    TransactionsModule,
    EmailModule,
    NotificationsModule,
    AlertsModule,
  ],
  controllers: [WalletController],
  providers: [WalletService, WalletDepositScheduler],
  exports: [WalletService],
})
export class WalletModule {}
