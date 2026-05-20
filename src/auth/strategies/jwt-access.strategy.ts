// src/auth/strategies/jwt-access.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  username: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('jwt.accessSecret'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub, isActive: true },
    });
    if (!user) throw new UnauthorizedException('User not found or inactive');
    if (!user.emailVerified) {
      throw new UnauthorizedException('Email verification required');
    }
    return user;
  }
}
