import { ConfigService } from '@nestjs/config';

export function isInsecureDeviceSignatureBypassEnabled(
  config: ConfigService,
): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return config.get<boolean>('app.allowInsecureDeviceSignatures', false);
}
