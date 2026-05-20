import { randomBytes } from 'crypto';

const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateShortCode(length = 8): string {
  return Array.from(
    randomBytes(length),
    (byte) => ALPHABET[byte % ALPHABET.length],
  ).join('');
}
