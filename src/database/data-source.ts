import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

import { User } from '../auth/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Device } from '../devices/entities/device.entity';
import { Otp } from '../otp/entities/otp.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { ExchangeRate } from '../rates/entities/exchange-rate.entity';
import { ShareEvent } from '../waitlist/entities/share-event.entity';
import { ReferralEvent } from '../waitlist/entities/referral-event.entity';
import { WaitlistEntry } from '../waitlist/entities/waitlist-entry.entity';
import { BlockchainWallet } from '../blockchain/entities/blockchain-wallet.entity';
import { BlockchainTransaction } from '../blockchain/entities/blockchain-transaction.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { PushSubscription } from '../notifications/entities/push-subscription.entity';
import { BankTransfer } from '../banks/entities/bank-transfer.entity';

const databaseUrl = process.env.DATABASE_URL;
const usePostgres = !!databaseUrl || !!process.env.DB_HOST;

let dataSourceConfig: any;

if (usePostgres) {
  // Use PostgreSQL when DATABASE_URL is provided or DB_HOST is configured
  if (databaseUrl) {
    // Use DATABASE_URL if provided (for production/Railway)
    dataSourceConfig = {
      type: 'postgres',
      url: databaseUrl,
      entities: [
        User,
        RefreshToken,
        Device,
        Otp,
        Transaction,
        ExchangeRate,
        ShareEvent,
        ReferralEvent,
        WaitlistEntry,
        BlockchainWallet,
        BlockchainTransaction,
        Notification,
        PushSubscription,
        BankTransfer,
      ],
      migrations: [join(__dirname, 'migrations/*.{ts,js}')],
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
    };
  } else {
    // Use individual DB_* environment variables
    dataSourceConfig = {
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: [
        User,
        RefreshToken,
        Device,
        Otp,
        Transaction,
        ExchangeRate,
        ShareEvent,
        ReferralEvent,
        WaitlistEntry,
        BlockchainWallet,
        BlockchainTransaction,
        Notification,
        PushSubscription,
        BankTransfer,
      ],
      migrations: [join(__dirname, 'migrations/*.{ts,js}')],
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
    };
  }
} else {
  // Local development: use postgres (no server required)
  // Exclude blockchain entities that use enums not supported by postgres
  dataSourceConfig = {
    type: 'postgres',
    database: (process.env.DB_NAME || 'cheese_wallet') + '.db',
    entities: [
      User,
      RefreshToken,
      Device,
      Otp,
      Transaction,
      ExchangeRate,
      ShareEvent,
      ReferralEvent,
      WaitlistEntry,
      // BlockchainWallet,    // Excluded locally: uses postgres enum types
      // BlockchainTransaction, // Excluded locally: uses postgres enum types
      Notification,
      PushSubscription,
      BankTransfer,
    ],
    migrations: [join(__dirname, 'migrations/*.{ts,js}')], // Enable migrations
    synchronize: false, // Disable synchronize when using migrations
  };
}

export const AppDataSource = new DataSource(dataSourceConfig);
