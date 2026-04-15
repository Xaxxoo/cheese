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
import { PulseMfbClient } from './pulsemfb.client';
import { BankTransfer } from './entities/bank-transfer.entity';
import { KycModule } from '../kyc/kyc.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Device, BankTransfer]),
    BlockchainModule,
    RatesModule,
    TransactionsModule,
    KycModule,
  ],
  controllers: [BanksController],
  providers: [BanksService, PulseMfbClient],
  exports: [BanksService],
})
export class BanksModule {}
