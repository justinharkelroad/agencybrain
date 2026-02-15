// Explicit user allowlist for Coaching Insights access.
const COACHING_INSIGHTS_ALLOWED_EMAILS = new Set([
  'josh@thekatylagency.com',
  'justin@hfiagencies.com',
]);

export function hasCoachingInsightsAccess(userEmail?: string | null): boolean {
  if (!userEmail) return false;
  return COACHING_INSIGHTS_ALLOWED_EMAILS.has(userEmail.toLowerCase());
}
