// src/veil/dto/index.ts
import { IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DepositDto {
  @ApiProperty({ example: 10.0, description: 'USDC to deposit into the shielded pool (0.5–50000)' })
  @IsNumber()
  @Min(0.5)
  @Max(50000)
  amountUsdc: number;

  @ApiPropertyOptional({ example: 'user-uuid', description: 'Cheese user ID to link note to (optional)' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class PayInvoiceDto {
  @ApiProperty({ example: 'note-uuid', description: 'ID of the shielded note to spend' })
  @IsUUID()
  noteId: string;

  @ApiProperty({ example: 'PI-A1B2C3D4E5F6G7H8', description: 'Private invoice reference' })
  @IsString()
  invoiceRef: string;

  @ApiProperty({ example: 5.0, description: 'Exact USDC amount to pay (must be ≤ note amount)' })
  @IsNumber()
  @Min(0.01)
  invoiceAmountUsdc: number;
}
