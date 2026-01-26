// Agencies with early access to 6-week challenge
export const CHALLENGE_BETA_AGENCY_IDS = [
  '979e8713-c266-4b23-96a9-fabd34f1fc9e', // Harkelroad Family Insurance (justin@hfiagencies.com)
  '48cf6af1-fe22-4cfc-85d7-caceea87e68a', // Test Account (agencybraintester@aol.com)
];

export function hasChallengeAccess(agencyId: string | null): boolean {
  if (!agencyId) return false;
  return CHALLENGE_BETA_AGENCY_IDS.includes(agencyId);
}
