// Agencies with beta access to sales features
export const SALES_BETA_AGENCY_IDS = [
  '1ddf77da-68a2-46a5-a32f-e813088b797e', // Chandler Insurance
  '979e8713-c266-4b23-96a9-fabd34f1fc9e', // Harkelroad Family Insurance
];

export function hasSalesBetaAccess(agencyId: string | null): boolean {
  if (!agencyId) return false;
  return SALES_BETA_AGENCY_IDS.includes(agencyId);
}
