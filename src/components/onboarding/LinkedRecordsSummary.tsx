// Stub component for linked records summary
// TODO: Implement full linked records display

interface LinkedRecordsSummaryProps {
  contactId: string | null;
  agencyId: string | null;
}

export function LinkedRecordsSummary({ contactId, agencyId }: LinkedRecordsSummaryProps) {
  if (!contactId || !agencyId) return null;
  return null;
}
