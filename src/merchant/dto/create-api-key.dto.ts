import { IsArray, IsIn, IsNotEmpty, IsString } from 'class-validator';

const VALID_SCOPES = [
  'payments:read',
  'payments:write',
  'settlements:read',
  'webhooks:read',
  'webhooks:write',
] as const;

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @IsIn(VALID_SCOPES, { each: true })
  scopes: string[];
}
