import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export interface AdminJwtPayload {
  sub: string;
  email: string;
  isAdmin: true;
  adminRole: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('jwt.accessSecret'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: AdminJwtPayload): Promise<User> {
    if (!payload.isAdmin) throw new UnauthorizedException('Not an admin token');

    const user = await this.userRepo.findOne({
      where: { id: payload.sub, isActive: true, isAdmin: true },
    });
    if (!user) throw new UnauthorizedException('Admin not found or inactive');
    return user;
  }
}
