// src/app.module.ts — ALL PHASES (1-7)
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';

import {
  appConfig,
  dbConfig,
  jwtConfig,
  otpConfig,
  ratesConfig,
  redisConfig,
  emailConfig,
  pulseMfbConfig,
  stellarConfig,
  dojahConfig,
} from './config/app.config';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { JwtAccessGuard } from './auth/guards/jwt.guard';

// Phase 1
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { OtpModule } from './otp/otp.module';
// import { BlockchainModule } from './blockchain/blockchain.module';
// Phase 2
import { WalletModule } from './wallet/wallet.module';
import { RatesModule } from './rates/rates.module';
import { TransactionsModule } from './transactions/transactions.module';
// Phase 3
import { SendModule } from './send/send.module';
// Phase 4
import { BanksModule } from './banks/banks.module';
// Phase 5
import { CardsModule } from './cards/cards.module';
// Phase 6
import { NotificationsModule } from './notifications/notifications.module';
import { ProfileModule } from './profile/profile.module';
// Phase 7
import { ReferralModule } from './referral/referral.module';
// Admin
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { MerchantModule } from './merchant/merchant.module';
// Email + Waitlist + PayLink
import { EmailModule } from './email/email.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { AgentsModule } from './agents/agents.module';
import { KycModule } from './kyc/kyc.module';
import { PayLinkModule } from './paylink/paylink.module';

// Active entities
import { User } from './auth/entities/user.entity';
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { Device } from './devices/entities/device.entity';
import { Otp } from './otp/entities/otp.entity';
import { ShareEvent } from './waitlist/entities/share-event.entity';
import { ReferralEvent } from './waitlist/entities/referral-event.entity';
import { WaitlistEntry } from './waitlist/entities/waitlist-entry.entity';
// Required by BlockchainModule (imported via AuthModule) and their scheduler
import { BlockchainWallet } from './blockchain/entities/blockchain-wallet.entity';
import { BlockchainTransaction } from './blockchain/entities/blockchain-transaction.entity';
// Required by NotificationsModule (imported via WaitlistModule and AgentsModule)
import { Notification } from './notifications/entities/notification.entity';
// Inactive entities — uncomment when their modules are re-enabled
import { Transaction } from './transactions/entities/transaction.entity';
import { ExchangeRate } from './rates/entities/exchange-rate.entity';
import { BankTransfer } from './banks/entities/bank-transfer.entity';
import { VirtualCard } from './cards/entities/virtual-card.entity';
import { Referral } from './referral/entities/referral.entity';
import { KycAttempt } from './kyc/entities/kyc-attempt.entity';
import { PaymentRequest } from './paylink/entities/payment-request.entity';
import { Merchant } from './merchant/entities/merchant.entity';
import { MerchantUser } from './merchant/entities/merchant-user.entity';
import { MerchantRefreshToken } from './merchant/entities/merchant-refresh-token.entity';
import { MerchantStore } from './merchant/entities/merchant-store.entity';
import { MerchantPayment } from './merchant/entities/merchant-payment.entity';
import { MerchantSettlement } from './merchant/entities/merchant-settlement.entity';
import { MerchantPayoutAccount } from './merchant/entities/merchant-payout-account.entity';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        dbConfig,
        jwtConfig,
        redisConfig,
        otpConfig,
        ratesConfig,
        emailConfig,
        pulseMfbConfig,
        stellarConfig,
        dojahConfig,
      ],
      envFilePath: ['.env'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('THROTTLE_TTL', 60) * 1000,
          limit: config.get('THROTTLE_LIMIT', 100),
        },
      ],
    }),
    // BullMQ — supports both REDIS_URL and REDIS_HOST
    ...(process.env.REDIS_URL || process.env.REDIS_HOST
      ? [
          BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
              const redisUrl = config.get<string>('redis.url');
              return {
                connection: redisUrl
                  ? { url: redisUrl }
                  : {
                      host: config.get('redis.host'),
                      port: config.get('redis.port', 6379),
                      password: config.get('redis.password'),
                    },
              };
            },
          }),
        ]
      : []),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const databaseUrl = process.env.DATABASE_URL;
        const usePostgres = !!databaseUrl || !!config.get('db.host');

        if (usePostgres) {
          // Use PostgreSQL when DATABASE_URL is provided or DB_HOST is configured
          if (databaseUrl) {
            // Use DATABASE_URL if provided (for production/Railway)
            return {
              type: 'postgres',
              url: databaseUrl,
              entities: [
                User,
                RefreshToken,
                Device,
                Otp,
                ShareEvent,
                ReferralEvent,
                WaitlistEntry,
                BlockchainWallet,
                BlockchainTransaction,
                Notification,
                // Uncomment as you re-enable each module:
                Transaction,
                ExchangeRate,
                BankTransfer,
                Referral,
                KycAttempt,
                VirtualCard,
                PaymentRequest,
                Merchant,
                MerchantUser,
                MerchantRefreshToken,
                MerchantStore,
                MerchantPayment,
                MerchantSettlement,
                MerchantPayoutAccount,
              ],
              synchronize: config.get<string>('app.nodeEnv') !== 'production',
              logging: config.get<string>('app.nodeEnv') === 'development',
              ssl:
                config.get<string>('app.nodeEnv') === 'production'
                  ? { rejectUnauthorized: false }
                  : false,
            } as TypeOrmModuleOptions;
          } else {
            // Use individual DB_* environment variables
            return {
              type: 'postgres',
              host: config.get<string>('db.host'),
              port: config.get<number>('db.port'),
              username: config.get<string>('db.user'),
              password: config.get<string>('db.pass'),
              database: config.get<string>('db.name'),
              entities: [
                User,
                RefreshToken,
                Device,
                Otp,
                ShareEvent,
                ReferralEvent,
                WaitlistEntry,
                BlockchainWallet,
                BlockchainTransaction,
                Notification,
                // Uncomment as you re-enable each module:
                Transaction,
                ExchangeRate,
                BankTransfer,
                Referral,
                KycAttempt,
                VirtualCard,
                PaymentRequest,
                Merchant,
                MerchantUser,
                MerchantRefreshToken,
                MerchantStore,
                MerchantPayment,
                MerchantSettlement,
                MerchantPayoutAccount,
              ],
              synchronize: config.get<string>('app.nodeEnv') !== 'production',
              logging: config.get<string>('app.nodeEnv') === 'development',
              ssl:
                config.get<string>('app.nodeEnv') === 'production'
                  ? { rejectUnauthorized: false }
                  : false,
            } as TypeOrmModuleOptions;
          }
        }

        // Local development: use postgres (no server required)
        return {
          type: 'postgres',
          database: `${config.get<string>('db.name')}.db`,
          entities: [
            User,
            RefreshToken,
            Device,
            Otp,
            ShareEvent,
            ReferralEvent,
            WaitlistEntry,
            BlockchainWallet,
            BlockchainTransaction,
            Notification,
            // Uncomment as you re-enable each module:
            Transaction,
            ExchangeRate,
            // BankTransfer,
            VirtualCard,
            // Referral,
            PaymentRequest,
            Merchant,
            MerchantUser,
            MerchantRefreshToken,
            MerchantStore,
            MerchantPayment,
            MerchantSettlement,
            MerchantPayoutAccount,
          ],
          synchronize: config.get<string>('app.nodeEnv') !== 'production',
          logging: config.get<string>('app.nodeEnv') === 'development',
        } as TypeOrmModuleOptions;
      },
    }),

    // Phase 1
    AuthModule,
    DevicesModule,
    OtpModule,
    // BlockchainModule,
    // Phase 2
    WalletModule,
    RatesModule,
    TransactionsModule,
    // Phase 3
    SendModule,
    // Phase 4
    BanksModule,
    // Phase 5
    CardsModule,
    // Phase 6
    NotificationsModule,
    ProfileModule,
    // Phase 7
    ReferralModule,
    // Email + Waitlist
    EmailModule,
    WaitlistModule,
    LeaderboardModule,
    AgentsModule,
    KycModule,
    AdminAuthModule,
    MerchantModule,
    PayLinkModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
