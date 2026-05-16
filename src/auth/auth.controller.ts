// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { JwtRefreshGuard } from './guards/jwt.guard';
import {
  ChangePinDto,
  CompleteDeviceRegistrationDto,
  CompleteDeviceRegistrationByLinkDto,
  RequestDeviceRegistrationDto,
  SetPinDto,
  ForgotPasswordDto,
  LoginDto,
  ResendOtpDto,
  ResetPasswordDto,
  SignupDto,
  VerifyOtpDto,
  VerifyPinDto,
} from './dto';
import { User } from './entities/user.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // ── POST /auth/signup ────────────────────────────────────
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates the account, provisions a Stellar USDC wallet, registers the device public key, and sends a 6-digit OTP to the email.',
  })
  @ApiResponse({
    status: 201,
    description: 'Account created — OTP sent to email',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({
    status: 403,
    description: 'Username is waitlist-reserved for a different email',
  })
  @ApiResponse({ status: 409, description: 'Email or username already taken' })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  // ── POST /auth/verify-otp ────────────────────────────────
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email OTP',
    description: 'Marks email as verified and returns auth tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified — returns accessToken + sets refresh cookie',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    if ('tokens' in result) {
      this.setRefreshCookie(res, result.tokens!.refreshToken);
      return {
        user: result.user,
        tokens: { accessToken: result.tokens!.accessToken },
      };
    }
    return result;
  }

  // ── POST /auth/resend-otp ────────────────────────────────
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend OTP',
    description:
      'Generates a fresh OTP and emails it. Rate-limited to prevent abuse.',
  })
  @ApiResponse({ status: 200, description: 'OTP resent' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.email, dto.type);
  }

  // ── POST /auth/login ─────────────────────────────────────
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login',
    description:
      'Verifies credentials and ECDSA device signature. Returns accessToken in body; sets httpOnly refresh cookie.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Login successful — accessToken in body, refreshToken in httpOnly cookie',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or device signature',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    this.setRefreshCookie(res, result.tokens.refreshToken);

    return {
      user: result.user,
      tokens: { accessToken: result.tokens.accessToken },
    };
  }

  // ── POST /auth/refresh ───────────────────────────────────
  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Reads the httpOnly refresh_token cookie, validates it, rotates it, and returns a new accessToken.',
  })
  @ApiResponse({ status: 200, description: 'New accessToken returned' })
  @ApiResponse({
    status: 401,
    description: 'Refresh token missing, expired or revoked',
  })
  async refresh(
    @Req() req: Request & { user: { user: User; tokenHash: string } },
  ) {
    return this.authService.refresh(req.user.user, req.user.tokenHash, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }

  // ── POST /auth/logout ────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout',
    description: 'Revokes the current refresh token and clears the cookie.',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  async logout(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rawToken = req.cookies?.['refresh_token'];
    const tokenHash = rawToken
      ? createHash('sha256')
          .update(rawToken as string)
          .digest('hex')
      : '';
    await this.authService.logout(user.id, tokenHash);
    res.clearCookie('refresh_token', { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
    return { message: 'Logged out' };
  }

  // ── GET /auth/me ──────────────────────────────────────────
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns the authenticated user profile.',
  })
  @ApiResponse({ status: 200, description: 'Authenticated user profile' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getMe(@CurrentUser() user: User) {
    return this.authService.getMe(user);
  }

  // ── POST /auth/forgot-password ────────────────────────────
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Sends a password-reset OTP to the email if the account exists. Always returns 200 to prevent email enumeration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reset code sent (if account exists)',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return { message: 'If an account exists, a reset code has been sent.' };
  }

  // ── POST /auth/reset-password ─────────────────────────────
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with OTP',
    description: 'Validates the OTP and updates the password.',
  })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successful' };
  }

  // ── POST /auth/verify-pin ─────────────────────────────────
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('verify-pin')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify PIN',
    description:
      'Validates a HMAC-SHA256(pin, deviceId) hash against the stored PIN hash. Returns { ok: true } on success.',
  })
  @ApiResponse({ status: 200, description: 'PIN valid — returns { ok: true }' })
  @ApiResponse({ status: 401, description: 'Invalid PIN or device' })
  async verifyPin(@CurrentUser() user: User, @Body() dto: VerifyPinDto) {
    return this.authService.verifyPin(user.id, dto);
  }

  // ── POST /auth/set-pin ────────────────────────────────────
  @Post('set-pin')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Set PIN (first time only)',
    description:
      'Sets the transaction PIN for a new account that has no PIN yet. ' +
      'The PIN is stored as HMAC-SHA256(pin, deviceId) — the raw PIN never leaves the device.\n\n' +
      'Returns 400 if a PIN is already set — use `POST /auth/change-pin` to update an existing PIN.',
  })
  @ApiResponse({ status: 200, description: 'PIN set successfully' })
  @ApiResponse({ status: 400, description: 'PIN already set' })
  async setPin(@CurrentUser() user: User, @Body() dto: SetPinDto) {
    await this.authService.setPin(user.id, dto);
    return { message: 'PIN set successfully' };
  }

  // ── POST /auth/reset-pin ─────────────────────────────────
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-pin')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Reset PIN',
    description: 'Clears the stored PIN hash so the user can set a new one via POST /auth/set-pin.',
  })
  @ApiResponse({ status: 200, description: 'PIN reset successfully' })
  async resetPin(@CurrentUser() user: User) {
    await this.authService.resetPin(user.id);
    return { message: 'PIN reset. Set a new PIN to continue.' };
  }

  // ── POST /auth/change-pin ─────────────────────────────────
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('change-pin')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Change PIN',
    description:
      'Verifies the current PIN hash and replaces it with a new one. Requires a valid device signature.',
  })
  @ApiResponse({ status: 200, description: 'PIN updated successfully' })
  @ApiResponse({
    status: 401,
    description: 'Current PIN incorrect or invalid device signature',
  })
  async changePin(@CurrentUser() user: User, @Body() dto: ChangePinDto) {
    await this.authService.changePin(user.id, dto);
    return { message: 'PIN updated successfully' };
  }

  // ── POST /auth/device-registration/request ───────────────
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('device-registration/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request device registration OTP',
    description:
      'Sends a 6-digit OTP to the email if the account exists. Always returns 200 to prevent email enumeration.',
  })
  @ApiResponse({ status: 200, description: 'OTP sent (if account exists)' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async requestDeviceRegistration(@Body() dto: RequestDeviceRegistrationDto) {
    await this.authService.requestDeviceRegistration(dto.email);
    return { message: 'If that email is registered, an OTP has been sent.' };
  }

  // ── POST /auth/device-registration/complete ──────────────
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('device-registration/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete device registration with OTP',
    description:
      'Verifies the OTP and registers the new device public key. After this, the device can log in normally.',
  })
  @ApiResponse({ status: 200, description: 'Device registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Device already registered' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async completeDeviceRegistration(@Body() dto: CompleteDeviceRegistrationDto) {
    await this.authService.completeDeviceRegistration(dto);
    return { message: 'Device registered successfully. You can now log in.' };
  }

  // ── POST /auth/device-registration/complete-link ──────────
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('device-registration/complete-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete device registration via magic link',
    description:
      'Called automatically by the frontend when the user clicks the device registration link in their email. ' +
      'The token comes from the ?token= query param in the link. The frontend generates deviceId and publicKey on the new device.',
  })
  @ApiResponse({ status: 200, description: 'Device registered successfully' })
  @ApiResponse({ status: 400, description: 'Link is invalid or has expired' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Device already registered' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async completeDeviceRegistrationByLink(@Body() dto: CompleteDeviceRegistrationByLinkDto) {
    await this.authService.completeDeviceRegistrationByLink(dto);
    return { message: 'Device registered successfully. You can now log in.' };
  }

  // ── Helpers ───────────────────────────────────────────────
  private setRefreshCookie(res: Response, token: string) {
    const days = 30;
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: days * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}
