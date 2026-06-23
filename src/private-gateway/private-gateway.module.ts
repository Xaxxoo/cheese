// src/private-gateway/private-gateway.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrivateInvoice } from './entities/private-invoice.entity';
import { PrivateGatewayController } from './private-gateway.controller';
import { PrivateGatewayService } from './private-gateway.service';
import { PrivateGatewayScheduler } from './private-gateway.scheduler';
import { ApiKeyGuard } from './guards/api-key.guard';
import { RatesModule } from '../rates/rates.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { PulseMfbClient } from '../banks/pulsemfb.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrivateInvoice]),
    RatesModule,
    BlockchainModule,
  ],
  controllers: [PrivateGatewayController],
  providers: [PrivateGatewayService, PrivateGatewayScheduler, PulseMfbClient, ApiKeyGuard],
})
export class PrivateGatewayModule {}
