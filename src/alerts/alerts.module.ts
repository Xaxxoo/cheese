// src/alerts/alerts.module.ts
import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
