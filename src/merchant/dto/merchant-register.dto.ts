import { IsEmail, IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class MerchantRegisterDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  baseCurrency: string;

  @IsIn(['instant_fiat', 'hold_usdc'])
  settlementMode: 'instant_fiat' | 'hold_usdc';
}
