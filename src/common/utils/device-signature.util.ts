import { ConfigService } from '@nestjs/config';

export function isInsecureDeviceSignatureBypassEnabled(
  config: ConfigService,
): boolean {
  return config.get<boolean>('app.allowInsecureDeviceSignatures', false);
}
