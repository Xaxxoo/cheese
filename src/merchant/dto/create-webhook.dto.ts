import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

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

export class CreateWebhookDto {
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsIn(VALID_EVENTS, { each: true })
  events: string[];
}
