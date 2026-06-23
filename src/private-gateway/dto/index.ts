// src/private-gateway/dto/index.ts
import { IsNumber, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePrivateInvoiceDto {
  @ApiProperty({ example: 10.0, description: 'Amount in USDC (0.5 – 50,000)' })
  @IsNumber()
  @Min(0.5)
  @Max(50000)
  amountUsdc: number;

  @ApiProperty({ example: 'merchant-001', description: "Merchant identifier / API key" })
  @IsString()
  merchantId: string;

  @ApiProperty({ example: 'TechStore Lagos', description: 'Display name shown in Veil wallet' })
  @IsString()
  merchantName: string;

  @ApiProperty({ example: '058', description: 'Bank code (e.g. 058 for GTBank)' })
  @IsString()
  settlementBankCode: string;

  @ApiProperty({ example: '0123456789', description: "Merchant's bank account number" })
  @IsString()
  settlementAccountNumber: string;

  @ApiProperty({ example: 'Guaranty Trust Bank', description: 'Full bank name' })
  @IsString()
  settlementBankName: string;

  @ApiProperty({ example: 'JOHN DOE', description: "Account holder's name as on bank record" })
  @IsString()
  settlementAccountName: string;

  @ApiPropertyOptional({ example: 'https://merchant.example.com/webhook', description: 'Webhook URL — called on status changes' })
  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  @ApiPropertyOptional({ example: 60, description: 'Invoice TTL in minutes (1–1440, default 60)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  expiresInMinutes?: number;
}
