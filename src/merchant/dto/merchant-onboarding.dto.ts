import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class MerchantOnboardingDto {
  @IsIn(['individual', 'business'])
  merchantType: 'individual' | 'business';

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  baseCurrency: string;

  @IsIn(['instant_fiat', 'hold_usdc'])
  settlementMode: 'instant_fiat' | 'hold_usdc';

  @IsIn(['instant', 'daily', 'weekly'])
  payoutSchedule: 'instant' | 'daily' | 'weekly';

  @IsString()
  @IsNotEmpty()
  storeName: string;
}
