// src/veil/veil.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ShieldedNote } from './entities/shielded-note.entity';
import { SpentNullifier } from './entities/spent-nullifier.entity';
import { VeilService } from './veil.service';
import { VeilController } from './veil.controller';
import { ApiKeyGuard } from '../private-gateway/guards/api-key.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShieldedNote, SpentNullifier]),
    BlockchainModule,
  ],
  controllers: [VeilController],
  providers: [VeilService, ApiKeyGuard],
  exports: [VeilService],
})
export class VeilModule {}
