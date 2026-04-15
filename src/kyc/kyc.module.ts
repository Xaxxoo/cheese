// src/kyc/kyc.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { EmailModule } from '../email/email.module';
import { KycAttempt } from './entities/kyc-attempt.entity';
import { DojahClient } from './dojah.client';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycAttempt, User]),
    EmailModule,
  ],
  controllers: [KycController],
  providers: [KycService, DojahClient],
  exports: [KycService],
})
export class KycModule {}
