// Agencies with early access to dashboard redesign (metric rings + accordion layout)
export const DASHBOARD_REDESIGN_AGENCY_IDS = [
  '16889dfb-b836-467d-986d-fcc3f0390eb3', // The Katyl Agency
  '979e8713-c266-4b23-96a9-fabd34f1fc9e', // Harkelroad Family Insurance
];

export function hasDashboardRedesign(agencyId: string | null): boolean {
  if (!agencyId) return false;
  return DASHBOARD_REDESIGN_AGENCY_IDS.includes(agencyId);
}
