// src/yield/yield.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletModule } from '../wallet/wallet.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AlertsModule } from '../alerts/alerts.module';
import { YieldController } from './yield.controller';
import { YieldService } from './yield.service';
import { BlendService } from './blend.service';
import { YieldScheduler } from './yield.scheduler';
import { YieldPoolScheduler } from './yield-pool.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Transaction]),
    BlockchainModule,
    TransactionsModule,
    WalletModule,
    EmailModule,
    NotificationsModule,
    AlertsModule,
  ],
  controllers: [YieldController],
  providers: [YieldService, BlendService, YieldScheduler, YieldPoolScheduler],
  exports: [YieldService, BlendService],
})
export class YieldModule {}
