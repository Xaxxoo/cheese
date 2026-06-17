import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl } from 'class-validator';

const VALID_EVENTS = [
  'payment.created',
  'payment.confirmed',
  'payment.settled',
  'payment.failed',
  'payment.expired',
  'settlement.queued',
  'settlement.completed',
  'settlement.failed',
] as const;

export class UpdateWebhookDto {
  @IsUrl({ require_tld: false })
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsIn(VALID_EVENTS, { each: true })
  @IsOptional()
  events?: string[];

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
