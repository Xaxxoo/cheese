// src/bridge/dto/index.ts
import {
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BridgeTransferDto {
  @ApiProperty({
    example: 'KE',
    description: 'ISO alpha-2 country code (KE, GH, RW, ET)',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  countryCode: string;

  @ApiProperty({
    example: '25.00',
    description: 'Amount to send in USDC (as a numeric string)',
  })
  @IsNumberString()
  amountUsdc: string;

  @ApiProperty({
    example: 'Jane Wanjiku',
    description: 'Full name of the recipient',
  })
  @IsString()
  @IsNotEmpty()
  recipientName: string;

  @ApiProperty({
    example: '+254712345678',
    description:
      'Recipient identifier — phone number (M-Pesa) or bank account number',
  })
  @IsString()
  @IsNotEmpty()
  accountIdentifier: string;

  @ApiPropertyOptional({
    example: 'KCB',
    description: 'Bank code (required for bank_transfer rail countries)',
  })
  @IsOptional()
  @IsString()
  bankCode?: string;

  @ApiPropertyOptional({
    example: 'KCB Bank',
    description: 'Bank name for display purposes',
  })
  @IsOptional()
  @IsString()
  bankName?: string;

  // ── Auth fields (same pattern as BankTransferDto) ──────────────────────────

  @ApiProperty({
    example: 'hmac-sha256-base64url-here',
    description:
      "HMAC-SHA256(pin, deviceId) — authorises the debit from the user's USDC wallet",
  })
  @IsString()
  @IsNotEmpty()
  pinHash: string;

  @ApiProperty({
    example: 'base64-ecdsa-signature-here',
    description: 'ECDSA P-256 device signature',
  })
  @IsString()
  @IsNotEmpty()
  deviceSignature: string;

  @ApiProperty({
    example: 'device-uuid-v4-here',
    description: 'Device ID of the signing device',
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiPropertyOptional({
    example: '1703673600000',
    description: 'Timestamp used when signing the canonical payload',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  timestamp?: string;

  @ApiPropertyOptional({
    example: 'b64url-random-nonce',
    description: 'Nonce used when signing the canonical payload',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  nonce?: string;
}

export class BridgeWebhookDto {
  @ApiProperty({
    example: 'transfer.updated',
    description: 'Bridge webhook event type',
  })
  @IsString()
  @IsNotEmpty()
  event: string;

  @ApiProperty({
    example: { id: 'tr_123', state: 'completed' },
    description: 'Event payload from Bridge',
  })
  @IsObject()
  data: Record<string, any>;
}
