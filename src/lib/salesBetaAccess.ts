// Agencies with beta access to sales features
export const SALES_BETA_AGENCY_IDS = [
  '1ddf77da-68a2-46a5-a32f-e813088b797e', // Chandler Insurance
  '979e8713-c266-4b23-96a9-fabd34f1fc9e', // Harkelroad Family Insurance
  '16889dfb-b836-467d-986d-fcc3f0390eb3', // Josh Katyl
  '9a19a14a-b7f8-47b4-a68a-dfb703bb9cb7', // Mercer
  '03176b18-e9fe-4970-9a15-117cdeba7129', // Nathan Giddings
];

export function hasSalesBetaAccess(agencyId: string | null): boolean {
  // Sales dashboard is now enabled for all agencies (RLS properly configured)
  return agencyId !== null && agencyId.length > 0;
}
