// src/app.module.ts — ALL PHASES (1-7)
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import {
  appConfig,
  dbConfig,
  jwtConfig,
  otpConfig,
  ratesConfig,
  redisConfig,
  emailConfig,
} from './config/app.config';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { JwtAccessGuard } from './auth/guards/jwt.guard';

// Phase 1
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { OtpModule } from './otp/otp.module';
// import { BlockchainModule } from './blockchain/blockchain.module';
// Phase 2 — commented out until needed
// import { WalletModule } from './wallet/wallet.module';
// import { RatesModule } from './rates/rates.module';
// import { TransactionsModule } from './transactions/transactions.module';
// Phase 3
// import { SendModule } from './send/send.module';
// Phase 4
// import { BanksModule } from './banks/banks.module';
// Phase 5
// import { CardsModule } from './cards/cards.module';
// Phase 6
// import { NotificationsModule } from './notifications/notifications.module';
// import { ProfileModule } from './profile/profile.module';
// Phase 7
// import { ReferralModule } from './referral/referral.module';
// Email + Waitlist + PayLink
import { EmailModule } from './email/email.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { AgentsModule } from './agents/agents.module';
// import { PayLinkModule } from './paylink/paylink.module';

// Active entities
import { User } from './auth/entities/user.entity';
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { Device } from './devices/entities/device.entity';
import { Otp } from './otp/entities/otp.entity';
import { ShareEvent } from './waitlist/entities/share-event.entity';
import { ReferralEvent } from './waitlist/entities/referral-event.entity';
import { WaitlistEntry } from './waitlist/entities/waitlist-entry.entity';
// import { BlockchainWallet } from './blockchain/entities/blockchain-wallet.entity';
// import { BlockchainTransaction } from './blockchain/entities/blockchain-transaction.entity';
// Inactive entities — uncomment when their modules are re-enabled
import { Transaction } from './transactions/entities/transaction.entity';
import { ExchangeRate } from './rates/entities/exchange-rate.entity';
// import { BankTransfer } from './banks/entities/bank-transfer.entity';
// import { VirtualCard } from './cards/entities/virtual-card.entity';
// import { Notification } from './notifications/entities/notification.entity';
// import { Referral } from './referral/entities/referral.entity';
// import { PaymentRequest } from './paylink/entities/payment-request.entity';

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
      useFactory: (config: ConfigService) => {
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
                // BlockchainWallet,
                // BlockchainTransaction,
                // Uncomment as you re-enable each module:
                Transaction,
                ExchangeRate,
                // BankTransfer,
                // VirtualCard,
                // Notification,
                // Referral,
                // PaymentRequest,
              ],
              synchronize: config.get('app.nodeEnv') !== 'production',
              logging: config.get('app.nodeEnv') === 'development',
              ssl:
                config.get('app.nodeEnv') === 'production'
                  ? { rejectUnauthorized: false }
                  : false,
            } as any;
          } else {
            // Use individual DB_* environment variables
            return {
              type: 'postgres',
              host: config.get('db.host'),
              port: config.get('db.port'),
              username: config.get('db.user'),
              password: config.get('db.pass'),
              database: config.get('db.name'),
              entities: [
                User,
                RefreshToken,
                Device,
                Otp,
                ShareEvent,
                ReferralEvent,
                WaitlistEntry,
                // BlockchainWallet,
                // BlockchainTransaction,
                // Uncomment as you re-enable each module:
                Transaction,
                ExchangeRate,
                // BankTransfer,
                // VirtualCard,
                // Notification,
                // Referral,
                // PaymentRequest,
              ],
              synchronize: config.get('app.nodeEnv') !== 'production',
              logging: config.get('app.nodeEnv') === 'development',
              ssl:
                config.get('app.nodeEnv') === 'production'
                  ? { rejectUnauthorized: false }
                  : false,
            } as any;
          }
        }

        // Local development: use postgres (no server required)
        return {
          type: 'postgres',
          database: config.get('db.name') + '.db',
          entities: [
            User,
            RefreshToken,
            Device,
            Otp,
            ShareEvent,
            ReferralEvent,
            WaitlistEntry,
            // BlockchainWallet,
            // BlockchainTransaction,
            // Uncomment as you re-enable each module:
            Transaction,
            ExchangeRate,
            // BankTransfer,
            // VirtualCard,
            // Notification,
            // Referral,
            // PaymentRequest,
          ],
          synchronize: config.get('app.nodeEnv') !== 'production',
          logging: config.get('app.nodeEnv') === 'development',
        } as any;
      },
    }),

    // Phase 1
    AuthModule,
    DevicesModule,
    OtpModule,
    // BlockchainModule,
    // Phase 2 — uncomment when ready
    // WalletModule,
    // RatesModule,
    // TransactionsModule,
    // Phase 3
    // SendModule,
    // Phase 4
    // BanksModule,
    // Phase 5
    // CardsModule,
    // Phase 6
    // NotificationsModule,
    // ProfileModule,
    // Phase 7
    // ReferralModule,
    // Email + Waitlist
    EmailModule,
    WaitlistModule,
    LeaderboardModule,
    AgentsModule,
    // PayLinkModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}