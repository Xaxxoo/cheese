import { IsNumber, IsPositive, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetRateDto {
  @ApiProperty({ example: 1390, description: 'USD → NGN rate to apply' })
  @IsNumber()
  @IsPositive()
  usdToNgn: number;

  @ApiPropertyOptional({ example: 0, description: 'Platform spread % (default 0)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  spreadPercent?: number;
}
