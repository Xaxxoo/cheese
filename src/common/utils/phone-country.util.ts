// src/common/utils/phone-country.util.ts
//
// Infers an ISO alpha-2 country code from an E.164 phone number.
// Covers African countries that CheesePay operates in. Falls back to
// null for unrecognised prefixes — callers should handle the null case.

const PHONE_PREFIX_TO_COUNTRY: [string, string][] = [
  // Ordered longest-prefix-first so +2547 doesn't shadow +254
  ['+234', 'NG'], // Nigeria
  ['+254', 'KE'], // Kenya
  ['+233', 'GH'], // Ghana
  ['+250', 'RW'], // Rwanda
  ['+251', 'ET'], // Ethiopia
  ['+27', 'ZA'],  // South Africa
  ['+255', 'TZ'], // Tanzania
  ['+256', 'UG'], // Uganda
  ['+237', 'CM'], // Cameroon
  ['+225', 'CI'], // Cote d'Ivoire
  ['+221', 'SN'], // Senegal
  ['+20', 'EG'],  // Egypt
  ['+212', 'MA'], // Morocco
  ['+216', 'TN'], // Tunisia
  ['+213', 'DZ'], // Algeria
  ['+1', 'US'],   // US / Canada (fallback)
  ['+44', 'GB'],  // UK
];

/**
 * Returns the ISO alpha-2 country code for the given E.164 phone number,
 * or null if the prefix is not recognised.
 */
export function countryFromPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.startsWith('+') ? phone : `+${phone}`;
  for (const [prefix, code] of PHONE_PREFIX_TO_COUNTRY) {
    if (normalized.startsWith(prefix)) return code;
  }
  return null;
}
