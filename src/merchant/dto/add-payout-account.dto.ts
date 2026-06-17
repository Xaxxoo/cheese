import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class AddPayoutAccountDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsIn(['bank', 'digital_dollar'])
  accountType: 'bank' | 'digital_dollar';

  @IsString()
  @IsNotEmpty()
  currency: string;

  /** Bank: "GTBank – 0123456789 – John Doe"  |  Digital dollar: wallet address */
  @IsString()
  @IsNotEmpty()
  destination: string;
}
