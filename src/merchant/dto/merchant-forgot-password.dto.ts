import { IsEmail } from 'class-validator';

export class MerchantForgotPasswordDto {
  @IsEmail()
  email: string;
}
