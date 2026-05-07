import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AdminJwtGuard extends AuthGuard('jwt-admin') {
  handleRequest<T>(err: Error, user: T): T {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Admin authentication required');
    }
    return user;
  }
}
