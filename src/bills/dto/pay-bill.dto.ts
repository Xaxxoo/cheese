// src/bills/dto/pay-bill.dto.ts
import {
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PayBillDto {
  @ApiProperty({
    example: 'mtn',
    description: "VTPass service ID, e.g. 'mtn', 'mtn-data', 'dstv', 'ikeja-electric'",
  })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({
    example: '08012345678',
    description: 'Phone number, smartcard number, or meter number',
  })
  @IsString()
  @IsNotEmpty()
  billersCode: string;

  @ApiPropertyOptional({
    example: 'mtn-500mb-30',
    description: 'Required for data/tv/electricity. Obtained from GET /bills/variations',
  })
  @IsOptional()
  @IsString()
  variationCode?: string;

  @ApiPropertyOptional({
    example: '1000',
    description: 'Required for airtime/electricity (open amount in NGN)',
  })
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiProperty({
    example: 'hmac-sha256-base64url-here',
    description: "HMAC-SHA256(pin, deviceId) — authorises the debit from the user's USDC wallet",
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
    description: 'Timestamp used when signing. Must be supplied together with nonce.',
  })
  @IsOptional()
  @IsString()
  timestamp?: string;

  @ApiPropertyOptional({
    example: 'b64url-random-nonce',
    description: 'Nonce used when signing. Must be supplied together with timestamp.',
  })
  @IsOptional()
  @IsString()
  nonce?: string;
}

export class VerifyBillCustomerDto {
  @ApiProperty({ example: 'dstv' })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  billersCode: string;
}
