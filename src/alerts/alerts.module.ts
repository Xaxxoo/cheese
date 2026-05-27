// src/alerts/alerts.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsService } from './alerts.service';
import { TelegramCommandsService } from './telegram-commands.service';
import { EmailModule } from '../email/email.module';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [EmailModule, TypeOrmModule.forFeature([User])],
  providers: [AlertsService, TelegramCommandsService],
  exports: [AlertsService],
})
export class AlertsModule {}
