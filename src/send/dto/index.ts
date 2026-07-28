// src/send/dto/index.ts
import { IsNotEmpty, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendToUsernameDto {
  @ApiProperty({
    example: 'ada_finance',
    description: 'Cheese Pay username of the recipient (without the @ sign)',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    example: '25.00',
    description:
      'Amount of USDC to send (as a numeric string to preserve precision). Minimum: 0.01 USDC.',
  })
  @IsNumberString()
  amountUsdc: string;

  @ApiProperty({
    example: 'hmac-sha256-base64url-here',
    description: "Sender's HMAC-SHA256(pin, userId) — authorises the debit",
  })
  @IsString()
  @IsNotEmpty()
  pinHash: string;

  @ApiProperty({
    example: 'base64-ecdsa-signature-here',
    description: 'ECDSA P-256 device signature of the transaction payload',
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
    example: 'stellar',
    description:
      'Network to send from — "stellar" (default) or an EVM chain name like "celo".',
  })
  @IsString()
  @IsOptional()
  network?: string;
}

export class SendToAddressDto {
  @ApiProperty({
    example: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    description: 'Destination Stellar public key (G-address, 56 characters)',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    example: '10.00',
    description:
      'Amount of USDC to send (as a numeric string). Minimum: 0.01 USDC.',
  })
  @IsNumberString()
  amountUsdc: string;

  @ApiProperty({
    example: 'stellar',
    description:
      'Network identifier — "stellar" or an EVM chain name like "celo".',
  })
  @IsString()
  @IsNotEmpty()
  network: string;

  @ApiProperty({
    example: 'hmac-sha256-base64url-here',
    description: "Sender's HMAC-SHA256(pin, userId) — authorises the debit",
  })
  @IsString()
  @IsNotEmpty()
  pinHash: string;

  @ApiProperty({
    example: 'base64-ecdsa-signature-here',
    description: 'ECDSA P-256 device signature of the transaction payload',
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
    example: '1234567890',
    description:
      'Destination tag / memo required by some exchanges (e.g. Binance, Kraken). ' +
      'When provided the transaction is sent via classic Stellar payment so the memo is included on-chain.',
  })
  @MaxLength(28)
  @IsString()
  @IsOptional()
  memo?: string;
}
