import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator'; // used at class level
import { MerchantAuthService } from './merchant-auth.service';
import { MerchantJwtGuard } from './guards/merchant-jwt.guard';
import type { MerchantJwtContext } from './strategies/merchant-jwt.strategy';
import { MerchantRegisterDto } from './dto/merchant-register.dto';
import { MerchantLoginDto } from './dto/merchant-login.dto';
import { MerchantVerifyEmailDto } from './dto/merchant-verify-email.dto';
import { MerchantTwoFactorDto } from './dto/merchant-2fa.dto';
import { MerchantOnboardingDto } from './dto/merchant-onboarding.dto';
import { MerchantForgotPasswordDto } from './dto/merchant-forgot-password.dto';

const COOKIE_NAME = 'merchant_refresh_token';

function setCookie(res: Response, token: string, isProd: boolean) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  });
}

function clearCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// @Public() at class level: tells the global JwtAccessGuard to skip this controller.
// MerchantJwtGuard is applied per-method for routes that actually need merchant auth.
@Public()
@Controller('merchant/auth')
export class MerchantAuthController {
  private readonly isProd: boolean;

  constructor(private readonly merchantAuthService: MerchantAuthService) {
    this.isProd = process.env.NODE_ENV === 'production';
  }

  @Post('register')
  async register(@Body() dto: MerchantRegisterDto) {
    return this.merchantAuthService.register(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: MerchantVerifyEmailDto) {
    return this.merchantAuthService.verifyEmail(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: MerchantLoginDto) {
    return this.merchantAuthService.login(dto);
  }

  @Post('2fa')
  @HttpCode(HttpStatus.OK)
  async completeTwoFactor(
    @Body() dto: MerchantTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.merchantAuthService.completeTwoFactor(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    const { refreshToken, ...rest } = session as { refreshToken: string } & Record<string, unknown>;
    setCookie(res, refreshToken, this.isProd);
    return rest;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: 'No refresh token' });
      return;
    }
    const result = await this.merchantAuthService.refresh(token, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setCookie(res, result.refreshToken, this.isProd);
    return { accessToken: result.accessToken };
  }

  @UseGuards(MerchantJwtGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (token) await this.merchantAuthService.logout(token);
    clearCookie(res);
  }

  @UseGuards(MerchantJwtGuard)
  @Get('me')
  async getMe(@Req() req: Request) {
    const ctx = (req as any).user as MerchantJwtContext;
    return this.merchantAuthService.getMe(ctx);
  }

  @UseGuards(MerchantJwtGuard)
  @Patch('onboarding')
  async completeOnboarding(@Req() req: Request, @Body() dto: MerchantOnboardingDto) {
    const ctx = (req as any).user as MerchantJwtContext;
    return this.merchantAuthService.completeOnboarding(ctx, dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: MerchantForgotPasswordDto) {
    return this.merchantAuthService.forgotPassword(dto.email);
  }
}
