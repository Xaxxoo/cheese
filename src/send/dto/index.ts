// src/send/dto/index.ts
import { IsNotEmpty, IsNumberString, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
    description: "Sender's HMAC-SHA256(pin, deviceId) — authorises the debit",
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
    description: 'Network identifier — currently only "stellar" is supported',
    enum: ['stellar'],
  })
  @IsString()
  @IsNotEmpty()
  network: string;

  @ApiProperty({
    example: 'hmac-sha256-base64url-here',
    description: "Sender's HMAC-SHA256(pin, deviceId) — authorises the debit",
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
}
