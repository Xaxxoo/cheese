import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BlockchainWallet } from './entities/blockchain-wallet.entity';
import { BlockchainTransaction } from './entities/blockchain-transaction.entity';
import { EvmChainCursor } from './entities/evm-chain-cursor.entity';
import { BlockchainService } from './services/blockchain.service';
import { WalletService } from './services/wallet.service';
import { BlockchainTransactionService } from './services/blockchain-transaction.service';
import { BlockchainScheduler } from './scheduler/blockchain.scheduler';
import { BlockchainController } from './controllers/blockchain.controller';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([BlockchainWallet, BlockchainTransaction, User, EvmChainCursor]),
  ],
  controllers: [BlockchainController],
  providers: [
    BlockchainService,
    WalletService,
    BlockchainTransactionService,
    BlockchainScheduler,
  ],
  exports: [
    /**
     * Export all three services so AuthModule and AccountingModule can inject them:
     *
     *   AuthModule       → injects WalletService (createWallet during OTP verification)
     *   AccountingModule → injects WalletService (debit/credit/getBalance)
     *
     * Both modules import BlockchainModule instead of re-providing BlockchainService.
     */
    BlockchainService,
    WalletService,
    BlockchainTransactionService,
    TypeOrmModule,
  ],
})
export class BlockchainModule {}
