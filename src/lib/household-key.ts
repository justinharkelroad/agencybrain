export const HOUSEHOLD_KEY_FALLBACK_NAME = 'UNKNOWN';
export const HOUSEHOLD_KEY_FALLBACK_ZIP = '00000';

export function normalizeHouseholdNamePart(value: string | null | undefined): string {
  const normalized = (value || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z]/g, '');

  return normalized || HOUSEHOLD_KEY_FALLBACK_NAME;
}

export function normalizeHouseholdZip(value: string | null | undefined): string {
  const normalized = (value || '').trim().slice(0, 5);
  return normalized || HOUSEHOLD_KEY_FALLBACK_ZIP;
}

export function generateHouseholdKey(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  zipCode: string | null | undefined,
): string {
  return `${normalizeHouseholdNamePart(lastName)}_${normalizeHouseholdNamePart(firstName)}_${normalizeHouseholdZip(zipCode)}`;
}
