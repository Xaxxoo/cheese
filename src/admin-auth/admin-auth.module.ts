import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { BankTransfer } from '../banks/entities/bank-transfer.entity';
import { PaymentRequest } from '../paylink/entities/payment-request.entity';
import { WaitlistEntry } from '../waitlist/entities/waitlist-entry.entity';
import { VirtualCard } from '../cards/entities/virtual-card.entity';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { AdminRatesController } from './admin-rates.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminTreasuryController } from './admin-treasury.controller';
import { AdminTreasuryService } from './admin-treasury.service';
import { RatesModule } from '../rates/rates.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, Transaction, BankTransfer, PaymentRequest, WaitlistEntry, VirtualCard]),
    PassportModule,
    JwtModule.register({}),
    RatesModule,
    BlockchainModule,
  ],
  controllers: [AdminAuthController, AdminRatesController, AdminDashboardController, AdminTreasuryController],
  providers: [AdminAuthService, AdminJwtStrategy, AdminTreasuryService],
  exports: [AdminJwtStrategy],
})
export class AdminAuthModule {}
