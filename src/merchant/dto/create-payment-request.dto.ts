import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class CreatePaymentRequestDto {
  @IsIn([
    'payment_link',
    'invoice',
    'checkout_session',
    'qr_static',
    'qr_dynamic',
    'api_request',
  ])
  kind: string;

  @IsNumber()
  @Min(0.01)
  fiatAmount: number;

  @IsString()
  fiatCurrency: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerEmail?: string;

  @IsIn(['instant_fiat', 'hold_usdc'])
  settlementMode: string;

  @IsString()
  settlementCurrency: string;

  @IsNumber()
  @Min(1)
  expirationMinutes: number;

  @IsUrl()
  @IsOptional()
  callbackUrl?: string;

  @IsOptional()
  metadata?: Record<string, string>;
}
