import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Merchant } from './entities/merchant.entity';
import { MerchantUser } from './entities/merchant-user.entity';
import { MerchantRefreshToken } from './entities/merchant-refresh-token.entity';
import { MerchantStore } from './entities/merchant-store.entity';
import { MerchantPayment } from './entities/merchant-payment.entity';
import { MerchantSettlement } from './entities/merchant-settlement.entity';
import { MerchantPayoutAccount } from './entities/merchant-payout-account.entity';
import { Otp } from '../otp/entities/otp.entity';
import { MerchantAuthController } from './merchant-auth.controller';
import { MerchantController } from './merchant.controller';
import { MerchantAuthService } from './merchant-auth.service';
import { MerchantService } from './merchant.service';
import { MerchantJwtStrategy } from './strategies/merchant-jwt.strategy';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      MerchantUser,
      MerchantRefreshToken,
      MerchantStore,
      MerchantPayment,
      MerchantSettlement,
      MerchantPayoutAccount,
      Otp,
    ]),
    PassportModule,
    JwtModule.register({}),
    EmailModule,
  ],
  controllers: [MerchantAuthController, MerchantController],
  providers: [MerchantAuthService, MerchantService, MerchantJwtStrategy],
  exports: [MerchantAuthService, MerchantService],
})
export class MerchantModule {}
