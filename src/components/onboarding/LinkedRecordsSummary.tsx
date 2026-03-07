// Linked records summary for contact intelligence panel

interface LinkedLQSRecord {
  id: string;
  [key: string]: any;
}
interface LinkedRenewalRecord {
  id: string;
  [key: string]: any;
}
interface LinkedCancelAuditRecord {
  id: string;
  [key: string]: any;
}
interface LinkedWinbackRecord {
  id: string;
  [key: string]: any;
}

interface LinkedRecordsSummaryProps {
  lqsRecords: LinkedLQSRecord[];
  renewalRecords: LinkedRenewalRecord[];
  cancelAuditRecords: LinkedCancelAuditRecord[];
  winbackRecords: LinkedWinbackRecord[];
}

export function LinkedRecordsSummary({
  lqsRecords,
  renewalRecords,
  cancelAuditRecords,
  winbackRecords,
}: LinkedRecordsSummaryProps) {
  const total = lqsRecords.length + renewalRecords.length + cancelAuditRecords.length + winbackRecords.length;
  if (total === 0) return null;

  return (
    <div className="text-xs text-muted-foreground space-y-1">
      {lqsRecords.length > 0 && <div>{lqsRecords.length} LQS record(s)</div>}
      {renewalRecords.length > 0 && <div>{renewalRecords.length} renewal(s)</div>}
      {cancelAuditRecords.length > 0 && <div>{cancelAuditRecords.length} cancel audit(s)</div>}
      {winbackRecords.length > 0 && <div>{winbackRecords.length} winback(s)</div>}
    </div>
  );
}
