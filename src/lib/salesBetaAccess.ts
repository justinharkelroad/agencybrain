export function hasSalesAccess(agencyId: string | null): boolean {
  return agencyId !== null && agencyId.length > 0;
}
