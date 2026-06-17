import { IsNotEmpty, IsString } from 'class-validator';

export class UpdatePayoutAccountDto {
  @IsString()
  @IsNotEmpty()
  label: string;
}
