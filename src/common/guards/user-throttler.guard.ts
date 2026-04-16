// src/common/guards/user-throttler.guard.ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Extends the default ThrottlerGuard with a smarter tracker key:
 *
 *  - Authenticated requests  → keyed by `user:<userId>`
 *    Prevents distributed brute-force where an attacker rotates IPs but
 *    always targets the same JWT-authenticated user (e.g. PIN guessing on
 *    /send, /banks/transfer, /card/cvv, etc.).
 *
 *  - Unauthenticated requests → keyed by `ip:<remoteIp>`
 *    Standard behaviour for public endpoints like /auth/login and /auth/signup.
 *
 * Registered as APP_GUARD so it replaces ThrottlerGuard globally.
 * All existing @Throttle() decorators continue to work unchanged.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const userId = (req.user as { id?: string } | undefined)?.id;
    if (userId) return Promise.resolve(`user:${userId}`);

    // Honour X-Forwarded-For when behind a reverse proxy, then fall back to req.ip
    const headers = req.headers as Record<
      string,
      string | string[] | undefined
    >;
    const forwarded = headers?.['x-forwarded-for'] as string | undefined;
    const ip =
      (forwarded ? forwarded.split(',')[0].trim() : (req.ip as string)) ??
      'unknown';
    return Promise.resolve(`ip:${ip}`);
  }
}
