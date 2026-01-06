import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { KycVerification } from './entities/kyc.entity';
import { KycService } from './services/kyc.service';
import { KycProviderService } from './services/kyc-provider.service';
import { KycController } from './controllers/kyc.controller';
import { KycEventListeners } from './listeners/kyc-event.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycVerification]),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ConfigModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [KycController],
  providers: [KycService, KycProviderService, KycEventListeners],
  exports: [KycService, KycProviderService],
})
export class KycModule {}