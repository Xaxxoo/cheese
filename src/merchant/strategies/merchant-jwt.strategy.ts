import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { MerchantUser } from '../entities/merchant-user.entity';
import { Merchant } from '../entities/merchant.entity';

export interface MerchantJwtPayload {
  sub: string;       // merchantUserId
  email: string;
  isMerchant: true;
  merchantId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface MerchantJwtContext {
  user: MerchantUser;
  merchant: Merchant;
}

@Injectable()
export class MerchantJwtStrategy extends PassportStrategy(Strategy, 'jwt-merchant') {
  constructor(
    config: ConfigService,
    @InjectRepository(MerchantUser)
    private readonly merchantUserRepo: Repository<MerchantUser>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('jwt.accessSecret'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: MerchantJwtPayload): Promise<MerchantJwtContext> {
    if (!payload.isMerchant) {
      throw new UnauthorizedException('Not a merchant token');
    }

    const merchantUser = await this.merchantUserRepo.findOne({
      where: { id: payload.sub, isActive: true },
    });
    if (!merchantUser) {
      throw new UnauthorizedException('Merchant user not found or inactive');
    }

    const merchant = await this.merchantRepo.findOne({
      where: { id: payload.merchantId, isActive: true },
      relations: ['stores'],
    });
    if (!merchant) {
      throw new UnauthorizedException('Merchant not found or inactive');
    }

    return { user: merchantUser, merchant };
  }
}
