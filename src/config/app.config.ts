// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  payLinkBaseUrl: process.env.PAYLINK_BASE_URL || 'https://cheesepay.xyz',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  allowInsecureDeviceSignatures:
    process.env.ALLOW_INSECURE_DEVICE_SIGNATURES === 'true',
}));

// export const dbConfig = registerAs('db', () => ({
//   host: process.env.DB_HOST,
//   port: parseInt(process.env.DB_PORT || '5432', 10),
//   name: process.env.DB_NAME,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASS,
// }));

export const dbConfig = registerAs('db', () => ({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  name: process.env.DB_NAME,
  user: process.env.DB_USER,
  pass: process.env.DB_PASS,
}));

export const jwtConfig = registerAs('jwt', () => {
  const isProd = process.env.NODE_ENV === 'production';
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (isProd && !accessSecret) {
    throw new Error('JWT_ACCESS_SECRET must be set in production');
  }
  if (isProd && !refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET must be set in production');
  }

  return {
    accessSecret: accessSecret || 'access-secret-dev-only',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshSecret: refreshSecret || 'refresh-secret-dev-only',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '30d',
  };
});

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
}));

export const stellarConfig = registerAs('stellar', () => ({
  network: process.env.STELLAR_NETWORK || 'mainnet',
  horizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon.stellar.org',
  usdcIssuer: process.env.STELLAR_USDC_ISSUER,
  masterSecret: process.env.STELLAR_MASTER_SECRET,
  encryptionKey: process.env.STELLAR_WALLET_ENCRYPTION_KEY,
}));

export const otpConfig = registerAs('otp', () => ({
  ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '900', 10),
  smtpHost: process.env.SMTP_HOST,
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  emailFrom: process.env.EMAIL_FROM || 'Cheese Pay <hi@cheesepay.xyz>',
}));

export const ratesConfig = registerAs('rates', () => ({
  exchangeRateUrl: process.env.EXCHANGE_RATE_URL,
  ngnSpreadPercent: parseFloat(process.env.NGN_SPREAD_PERCENT || '1.5'),
}));

export const emailConfig = registerAs('email', () => ({
  resendApiKey: process.env.RESEND_API_KEY,
  fromAddress: process.env.EMAIL_FROM || 'hi@cheesepay.xyz',
  fromName: process.env.EMAIL_FROM_NAME || 'Cheese Pay',
  replyTo: process.env.EMAIL_REPLY_TO || 'hi@cheesepay.xyz',
}));

export const dojahConfig = registerAs('dojah', () => ({
  appId: process.env.DOJAH_APP_ID,
  secretKey: process.env.DOJAH_SECRET_KEY,
}));

export const pulseMfbConfig = registerAs('pulsemfb', () => ({
  baseUrl: process.env.PULSE_MFB_BASE_URL || 'https://api.pulsemfb.com',
  publicKey: process.env.PULSE_MFB_PUBLIC_KEY,
  privateKey: process.env.PULSE_MFB_PRIVATE_KEY,
  debitAccount: process.env.PULSE_MFB_DEBIT_ACCOUNT, // platform's NGN account at PulseMFB
  webhookSecret: process.env.PULSE_MFB_WEBHOOK_SECRET, // for verifying inbound webhooks
}));

export const alertsConfig = registerAs('alerts', () => ({
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  adminAlertEmail: process.env.ADMIN_ALERT_EMAIL,
}));

export const vtpassConfig = registerAs('vtpass', () => ({
  baseUrl: process.env.VTPASS_BASE_URL || 'https://sandbox.vtpass.com/api',
  apiKey: process.env.VTPASS_API_KEY,
  secretKey: process.env.VTPASS_SECRET_KEY,
}));
