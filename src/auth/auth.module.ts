// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { OtpModule } from '../otp/otp.module';
import { EmailModule } from '../email/email.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ReferralModule } from '../referral/referral.module';
import { Device } from '../devices/entities/device.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { WaitlistEntry } from '../waitlist/entities/waitlist-entry.entity';
import { ReferralEvent } from '../waitlist/entities/referral-event.entity';
import { WalletCreationProcessor } from './processors/wallet-creation.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      Device,
      WaitlistEntry,
      ReferralEvent,
    ]),
    // Only register the wallet-creation queue when Redis is available
    ...(process.env.REDIS_URL || process.env.REDIS_HOST
      ? [BullModule.registerQueue({ name: 'wallet-creation' })]
      : []),
    PassportModule,
    JwtModule.register({}),
    OtpModule,
    BlockchainModule,
    EmailModule,
    ReferralModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    // Only register the processor when Redis is available — the @Processor
    // decorator tries to connect to the queue at startup and crashes without it
    ...(process.env.REDIS_URL || process.env.REDIS_HOST
      ? [WalletCreationProcessor]
      : []),
  ],
  exports: [AuthService, TypeOrmModule],
})
export class AuthModule {}
