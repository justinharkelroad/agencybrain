import { DollarSign, FileText, ShieldCheck, AlertTriangle, Target } from 'lucide-react';
import type {
  LinkedLQSRecord,
  LinkedRenewalRecord,
  LinkedCancelAuditRecord,
  LinkedWinbackRecord,
} from '@/types/contact';

interface LinkedRecordsSummaryProps {
  lqsRecords: LinkedLQSRecord[];
  renewalRecords: LinkedRenewalRecord[];
  cancelAuditRecords: LinkedCancelAuditRecord[];
  winbackRecords: LinkedWinbackRecord[];
}

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function LinkedRecordsSummary({
  lqsRecords,
  renewalRecords,
  cancelAuditRecords,
  winbackRecords,
}: LinkedRecordsSummaryProps) {
  // LQS stats (premium in cents)
  const totalQuotes = lqsRecords.reduce((sum, r) => sum + (r.quotes?.length || 0), 0);
  const totalSales = lqsRecords.reduce((sum, r) => sum + (r.sales?.length || 0), 0);
  const quotedPremium = lqsRecords.reduce((sum, r) => {
    return sum + (r.quotes || []).reduce((qs, q) => qs + (q.premium_cents || 0), 0);
  }, 0) / 100;
  const soldPremium = lqsRecords.reduce((sum, r) => {
    return sum + (r.sales || []).reduce((ss, s) => ss + (s.premium_cents || 0), 0);
  }, 0) / 100;

  // Renewal stats (premium in dollars)
  const activeRenewals = renewalRecords.filter(r => r.is_active).length;

  // Cancel audit stats (premium in cents)
  const activeCancelAudits = cancelAuditRecords.filter(
    r => !r.cancel_status || (r.cancel_status !== 'Saved' && r.cancel_status !== 'saved')
  ).length;
  const savedCount = cancelAuditRecords.filter(
    r => r.cancel_status === 'Saved' || r.cancel_status === 'saved'
  ).length;

  // Winback stats (premium in cents)
  const activeWinbacks = winbackRecords.filter(
    r => r.status === 'untouched' || r.status === 'in_progress'
  ).length;
  const winbackPremium = winbackRecords.reduce(
    (sum, r) => sum + (r.total_premium_potential_cents || 0), 0
  ) / 100;

  const hasAnyData = totalQuotes > 0 || totalSales > 0 || activeRenewals > 0 ||
    cancelAuditRecords.length > 0 || winbackRecords.length > 0;

  if (!hasAnyData) {
    return (
      <div className="text-center py-3 text-xs text-muted-foreground">
        No linked records
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {totalQuotes > 0 && (
        <StatPill
          icon={<FileText className="h-3.5 w-3.5 text-blue-500" />}
          label="Quotes"
          value={`${totalQuotes}`}
          subValue={quotedPremium > 0 ? fmt.format(quotedPremium) : undefined}
        />
      )}
      {totalSales > 0 && (
        <StatPill
          icon={<DollarSign className="h-3.5 w-3.5 text-green-500" />}
          label="Sales"
          value={`${totalSales}`}
          subValue={soldPremium > 0 ? fmt.format(soldPremium) : undefined}
        />
      )}
      {activeRenewals > 0 && (
        <StatPill
          icon={<ShieldCheck className="h-3.5 w-3.5 text-yellow-500" />}
          label="Renewals"
          value={`${activeRenewals} active`}
        />
      )}
      {cancelAuditRecords.length > 0 && (
        <StatPill
          icon={<AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
          label="Cancel Audit"
          value={activeCancelAudits > 0 ? `${activeCancelAudits} active` : `${savedCount} saved`}
        />
      )}
      {winbackRecords.length > 0 && (
        <StatPill
          icon={<Target className="h-3.5 w-3.5 text-purple-500" />}
          label="Winback"
          value={activeWinbacks > 0 ? `${activeWinbacks} active` : `${winbackRecords.length} total`}
          subValue={winbackPremium > 0 ? fmt.format(winbackPremium) : undefined}
        />
      )}
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
      {icon}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium leading-tight">{value}</p>
        {subValue && (
          <p className="text-[10px] text-muted-foreground">{subValue}</p>
        )}
      </div>
    </div>
  );
}
