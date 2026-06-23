// src/private-gateway/guards/api-key.guard.ts
//
// Checks the X-Api-Key header against PRIVATE_GATEWAY_API_KEY env var.
// If the env var is not set, all requests are allowed (dev mode).
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredKey = this.config.get<string>('PRIVATE_GATEWAY_API_KEY');
    if (!requiredKey) return true; // dev mode — no key configured

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-api-key'];

    if (!provided || provided !== requiredKey) {
      throw new UnauthorizedException('Invalid or missing X-Api-Key');
    }
    return true;
  }
}
