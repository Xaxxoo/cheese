// src/auth/strategies/jwt-refresh.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly rtRepo: Repository<RefreshToken>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies?.['refresh_token'] as string) || null,
      ]),
      secretOrKey: config.get<string>('jwt.refreshSecret'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _payload: { sub: string },
  ): Promise<{ user: User; tokenHash: string }> {
    const rawToken = req.cookies?.['refresh_token'] as string | undefined;
    if (!rawToken) throw new UnauthorizedException('No refresh token');

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const stored = await this.rtRepo.findOne({
      where: { tokenHash, isRevoked: false },
      relations: ['user'],
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }
    if (!stored.user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    if (!stored.user.emailVerified) {
      await this.rtRepo.update({ id: stored.id }, { isRevoked: true });
      throw new UnauthorizedException('Email verification required');
    }

    return { user: stored.user, tokenHash };
  }
}
