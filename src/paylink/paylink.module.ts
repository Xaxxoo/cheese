// src/paylink/paylink.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Device } from '../devices/entities/device.entity';
import { EmailModule } from '../email/email.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { RatesModule } from '../rates/rates.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentRequest } from './entities/payment-request.entity';
import { PayLinkController } from './paylink.controller';
import { PayLinkService } from './paylink.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentRequest, User, Device]),
    BlockchainModule,
    RatesModule,
    TransactionsModule,
    EmailModule,
    NotificationsModule,
  ],
  controllers: [PayLinkController],
  providers: [PayLinkService],
  exports: [PayLinkService],
})
export class PayLinkModule {}
