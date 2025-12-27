import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCancelAuditRecords, RecordWithActivityCount } from '@/hooks/useCancelAuditRecords';
import { formatCentsToCurrency, formatDateShort } from '@/lib/cancel-audit-utils';

interface HouseholdPoliciesProps {
  currentRecordId: string;
  householdKey: string;
  agencyId: string;
}

export function HouseholdPolicies({ currentRecordId, householdKey, agencyId }: HouseholdPoliciesProps) {
  const { data: allRecords } = useCancelAuditRecords({
    agencyId,
    viewMode: 'all',
    reportTypeFilter: 'all',
    searchQuery: '',
    sortBy: 'urgency',
  });

  // Filter to same household, exclude current record
  const otherPolicies = allRecords?.filter(
    r => r.household_key === householdKey && r.id !== currentRecordId
  ) || [];

  if (otherPolicies.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
      <div className="flex items-center gap-2 text-sm font-medium text-purple-400 mb-2">
        <AlertTriangle className="h-4 w-4" />
        <span>{otherPolicies.length} Other {otherPolicies.length === 1 ? 'Policy' : 'Policies'} for This Household</span>
      </div>
      <div className="space-y-2">
        {otherPolicies.map(policy => (
          <PolicyRow key={policy.id} policy={policy} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        💡 Tip: Mention all policies when speaking with this customer
      </p>
    </div>
  );
}

function PolicyRow({ policy }: { policy: RecordWithActivityCount }) {
  const date = policy.report_type === 'cancellation' 
    ? policy.cancel_date 
    : policy.pending_cancel_date;
  
  return (
    <div className="flex items-center justify-between text-sm bg-card/50 p-2 rounded">
      <div className="flex items-center gap-3">
        <span className={cn(
          "text-xs px-2 py-0.5 rounded border",
          policy.report_type === 'cancellation' 
            ? "bg-red-500/10 text-red-400 border-red-500/20" 
            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
        )}>
          {policy.report_type === 'cancellation' ? 'Cancelled' : 'Pending'}
        </span>
        <span className="text-muted-foreground font-mono text-xs">{policy.policy_number}</span>
        <span className="text-foreground">{policy.product_name || '--'}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-xs">
          {formatDateShort(date)}
        </span>
        <span className="font-medium">{formatCentsToCurrency(policy.premium_cents)}</span>
      </div>
    </div>
  );
}
