// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    rawBody: true,  // needed for PulseMFB webhook signature verification
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 3001);
  const origin = config.get<string>('app.frontendUrl', 'http://localhost:3000');
  // ── Security ─────────────────────────────────────────────
  // Disable CSP — this is a pure API server, CSP is a browser concern
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());

  // ── CORS ────────────────────────────────────────────────
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://cheesepay.xyz',
      'https://www.cheesepay.xyz',
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // ── Global validation ────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── API prefix ───────────────────────────────────────────
  app.setGlobalPrefix('v1');

  // ── Swagger ──────────────────────────────────────────────
  {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('🧀 Cheese Pay API')
      .setDescription(
        '## Cheese Pay — Custodial USDC Wallet for Nigeria\n\n' +
          'All endpoints are prefixed with **/v1**.\n\n' +
          '### How to authenticate\n' +
          '1. **POST /v1/auth/signup** — create an account\n' +
          '2. **POST /v1/auth/verify-otp** — confirm email\n' +
          '3. **POST /v1/auth/login** — copy the `accessToken` from the response\n' +
          '4. Click **Authorize 🔓** above and paste: `Bearer <accessToken>`\n\n' +
          'The refresh token is set as an httpOnly cookie automatically.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description:
            'Enter your access token (Swagger adds the "Bearer " prefix)',
          in: 'header',
        },
        'access-token',
      )
      .addTag('Auth', 'Signup · Login · OTP · PIN · Password reset')
      .addTag('KYC', 'BVN · NIN · Selfie face-match · Tier upgrades')
      .addTag('Devices', 'Device key registration and management')
      .addTag('Wallet', 'Stellar USDC balance and deposit address')
      .addTag('Rates', 'USD → NGN exchange rate (cached 60 s)')
      .addTag('Transactions', 'Transaction history with pagination')
      .addTag('Send', 'Send USDC by username or Stellar address')
      .addTag('Banks', 'Nigerian banks · Account resolution · NGN payout')
      .addTag('Card', 'Virtual Mastercard — provision · freeze · CVV reveal')
      .addTag('Notifications', 'In-app notification feed')
      .addTag('Profile', 'Update display name · username · phone number')
      .addTag('Earn', '5 % APY USDC yield positions')
      .addTag('Referral', 'Referral codes, share links and reward tracking')
      .addTag('Waitlist', 'Pre-launch waitlist and username reservation')
      .addTag('PayLink', 'Cash App-style payment request links')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true, // token survives page refresh
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'none', // start collapsed
        filter: true, // enable search bar
        showRequestDuration: true, // show ms latency on responses
      },
      customSiteTitle: '🧀 Cheese Pay API Docs',
    });

    console.log(`   Swagger UI  : http://localhost:${port}/api/docs`);
  }

  // ── Graceful shutdown ────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port);
  console.log(`\n🧀 Cheese Pay API  →  http://localhost:${port}/v1`);
  console.log(`   Environment : ${config.get('app.nodeEnv')}`);
  console.log(`   Stellar     : ${config.get('stellar.network') ?? 'NOT SET'} | key=${process.env.STELLAR_PLATFORM_SECRET_KEY ? 'SET' : 'MISSING'} | horizon=${process.env.STELLAR_HORIZON_URL ?? 'MISSING'} | enc=${process.env.SECRET_ENCRYPTION_KEY ? 'SET' : 'MISSING'}`);
  console.log(`   Frontend    : ${origin}\n`);
}

bootstrap();
