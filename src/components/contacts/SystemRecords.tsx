import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, FileText, RefreshCw, AlertTriangle, Target, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { PremiumChangeDisplay } from './PremiumChangeDisplay';
import { WinbackPoliciesTable, LqsQuotesTable, LqsSalesTable } from './PolicyDetailsTable';
import type {
  LinkedLQSRecord,
  LinkedRenewalRecord,
  LinkedCancelAuditRecord,
  LinkedWinbackRecord,
} from '@/types/contact';

interface SystemRecordsProps {
  lqsRecords: LinkedLQSRecord[];
  renewalRecords: LinkedRenewalRecord[];
  cancelAuditRecords: LinkedCancelAuditRecord[];
  winbackRecords: LinkedWinbackRecord[];
  onViewRecord?: (type: string, id: string) => void;
}

export function SystemRecords({
  lqsRecords,
  renewalRecords,
  cancelAuditRecords,
  winbackRecords,
  onViewRecord,
}: SystemRecordsProps) {
  const hasAnyRecords =
    lqsRecords.length > 0 ||
    renewalRecords.length > 0 ||
    cancelAuditRecords.length > 0 ||
    winbackRecords.length > 0;

  if (!hasAnyRecords) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
        <p>No linked records found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* LQS Records */}
      {lqsRecords.length > 0 && (
        <RecordSection
          title="LQS Records"
          icon={<FileText className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-50"
          count={lqsRecords.length}
        >
          {lqsRecords.map((record) => (
            <LQSRecordCard
              key={record.id}
              record={record}
              onView={() => onViewRecord?.('lqs', record.id)}
            />
          ))}
        </RecordSection>
      )}

      {/* Renewal Records */}
      {renewalRecords.length > 0 && (
        <RecordSection
          title="Renewal Records"
          icon={<RefreshCw className="h-4 w-4 text-green-600" />}
          iconBg="bg-green-50"
          count={renewalRecords.length}
        >
          {renewalRecords.map((record) => (
            <RenewalRecordCard
              key={record.id}
              record={record}
              onView={() => onViewRecord?.('renewal', record.id)}
            />
          ))}
        </RecordSection>
      )}

      {/* Cancel Audit Records */}
      {cancelAuditRecords.length > 0 && (
        <RecordSection
          title="Cancel Audit Records"
          icon={<AlertTriangle className="h-4 w-4 text-orange-600" />}
          iconBg="bg-orange-50"
          count={cancelAuditRecords.length}
        >
          {cancelAuditRecords.map((record) => (
            <CancelAuditRecordCard
              key={record.id}
              record={record}
              onView={() => onViewRecord?.('cancel_audit', record.id)}
            />
          ))}
        </RecordSection>
      )}

      {/* Winback Records */}
      {winbackRecords.length > 0 && (
        <RecordSection
          title="Winback Records"
          icon={<Target className="h-4 w-4 text-purple-600" />}
          iconBg="bg-purple-50"
          count={winbackRecords.length}
        >
          {winbackRecords.map((record) => (
            <WinbackRecordCard
              key={record.id}
              record={record}
              onView={() => onViewRecord?.('winback', record.id)}
            />
          ))}
        </RecordSection>
      )}
    </div>
  );
}

// Section wrapper with count badge
function RecordSection({
  title,
  icon,
  iconBg,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('p-1.5 rounded', iconBg)}>{icon}</div>
        <h4 className="text-sm font-medium">{title}</h4>
        {count && count > 0 && (
          <Badge variant="secondary" className="text-xs">
            {count}
          </Badge>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ==================== LQS Record Card (Enhanced) ====================

function LQSRecordCard({
  record,
  onView,
}: {
  record: LinkedLQSRecord;
  onView?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasDetails = (record.quotes?.length || 0) > 0 || (record.sales?.length || 0) > 0;

  // Calculate totals
  const totalQuotedPremium = (record.quotes || []).reduce((sum, q) => sum + (q.premium_cents || 0), 0);
  const totalSoldPremium = (record.sales || []).reduce((sum, s) => sum + (s.premium_cents || 0), 0);

  return (
    <Card className="bg-muted/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant={record.status === 'sold' || record.status === 'Sold' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {record.status || 'Lead'}
                </Badge>
                {record.lead_source_name && (
                  <span className="text-xs text-muted-foreground">
                    Source: {record.lead_source_name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {record.team_member_name && <span>Agent: {record.team_member_name}</span>}
                {record.created_at && (
                  <span>Created: {format(new Date(record.created_at), 'MMM d, yyyy')}</span>
                )}
              </div>
              {/* Quick summary of quotes and sales */}
              <div className="flex items-center gap-4 text-xs mt-1">
                {(record.quotes?.length || 0) > 0 && (
                  <span className="text-blue-600">
                    {record.quotes?.length} quote{record.quotes?.length !== 1 ? 's' : ''} (${(totalQuotedPremium / 100).toLocaleString()})
                  </span>
                )}
                {(record.sales?.length || 0) > 0 && (
                  <span className="text-green-600">
                    {record.sales?.length} sale{record.sales?.length !== 1 ? 's' : ''} (${(totalSoldPremium / 100).toLocaleString()})
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {hasDetails && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>

          {/* Expandable details */}
          <CollapsibleContent className="mt-3 space-y-3">
            {(record.quotes?.length || 0) > 0 && (
              <div>
                <h5 className="text-xs font-medium mb-1 text-blue-600">Quotes ({record.quotes?.length})</h5>
                <LqsQuotesTable quotes={record.quotes || []} />
              </div>
            )}
            {(record.sales?.length || 0) > 0 && (
              <div>
                <h5 className="text-xs font-medium mb-1 text-green-600">Sales ({record.sales?.length})</h5>
                <LqsSalesTable sales={record.sales || []} />
              </div>
            )}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

// ==================== Renewal Record Card (Enhanced) ====================

function RenewalRecordCard({
  record,
  onView,
}: {
  record: LinkedRenewalRecord;
  onView?: () => void;
}) {
  const statusColors: Record<string, string> = {
    uncontacted: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-700',
    success: 'bg-green-100 text-green-700',
    unsuccessful: 'bg-red-100 text-red-700',
  };

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium font-mono">{record.policy_number}</span>
              <Badge
                className={cn('text-xs', statusColors[record.current_status] || 'bg-gray-100')}
              >
                {record.current_status}
              </Badge>
            </div>
            {record.assigned_team_member_name && (
              <span className="text-xs text-muted-foreground">
                Assigned: {record.assigned_team_member_name}
              </span>
            )}
          </div>

          {/* Product and due date */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {record.product_name && <span>{record.product_name}</span>}
            <span>Due: {format(new Date(record.renewal_effective_date), 'MMM d, yyyy')}</span>
          </div>

          {/* Premium change - the main enhancement */}
          {(record.premium_old != null || record.premium_new != null) && (
            <div className="flex items-center gap-2 pt-1">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <PremiumChangeDisplay
                premiumOld={record.premium_old}
                premiumNew={record.premium_new}
                changePercent={record.premium_change_percent}
                isCents={false}
                size="sm"
              />
            </div>
          )}

          {/* Additional info row */}
          <div className="flex items-center gap-3 text-xs">
            {record.amount_due != null && record.amount_due > 0 && (
              <span className="text-orange-600 font-medium">
                Amount Due: ${record.amount_due.toLocaleString()}
              </span>
            )}
            {record.easy_pay && (
              <Badge variant="outline" className="text-xs py-0">Easy Pay</Badge>
            )}
            {record.multi_line_indicator && (
              <Badge variant="outline" className="text-xs py-0">Multi-Line</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Cancel Audit Record Card (Enhanced) ====================

function CancelAuditRecordCard({
  record,
  onView,
}: {
  record: LinkedCancelAuditRecord;
  onView?: () => void;
}) {
  const statusColors: Record<string, string> = {
    Uncontacted: 'bg-gray-100 text-gray-700',
    'In Progress': 'bg-yellow-100 text-yellow-700',
    Saved: 'bg-green-100 text-green-700',
    Lost: 'bg-red-100 text-red-700',
  };

  const hasOutstandingBalance = (record.amount_due_cents || 0) > 0;

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {record.policy_number && (
                <span className="text-sm font-medium font-mono">{record.policy_number}</span>
              )}
              <Badge
                className={cn('text-xs', statusColors[record.cancel_status || ''] || 'bg-gray-100')}
              >
                {record.cancel_status || 'Unknown'}
              </Badge>
            </div>
            {record.assigned_team_member_name && (
              <span className="text-xs text-muted-foreground">
                Assigned: {record.assigned_team_member_name}
              </span>
            )}
          </div>

          {/* Product and dates */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {record.product_name && <span>{record.product_name}</span>}
            {record.account_type && (
              <Badge variant="outline" className="text-xs py-0">{record.account_type}</Badge>
            )}
          </div>

          {/* Financial info - the main enhancement */}
          <div className="flex items-center gap-4 text-xs">
            {record.premium_cents != null && (
              <span>
                Premium: <span className="font-medium">${((record.premium_cents || 0) / 100).toLocaleString()}</span>
              </span>
            )}
            {hasOutstandingBalance && (
              <span className={cn('font-medium', 'text-orange-600')}>
                Amount Due: ${((record.amount_due_cents || 0) / 100).toLocaleString()}
              </span>
            )}
          </div>

          {/* Dates */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {record.cancel_date && (
              <span>Cancel Date: {format(new Date(record.cancel_date), 'MMM d, yyyy')}</span>
            )}
            {record.pending_cancel_date && (
              <span className="text-orange-600">
                Pending Cancel: {format(new Date(record.pending_cancel_date), 'MMM d, yyyy')}
              </span>
            )}
          </div>

          {/* Report type badge */}
          {record.report_type && (
            <Badge variant="outline" className="text-xs py-0">
              {record.report_type === 'cancellation' ? 'Cancellation' : 'Pending Cancel'}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Winback Record Card (Enhanced - Main Gap Fix) ====================

function WinbackRecordCard({
  record,
  onView,
}: {
  record: LinkedWinbackRecord;
  onView?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasDetails = (record.policies?.length || 0) > 0;

  const statusColors: Record<string, string> = {
    untouched: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    teed_up_this_week: 'bg-blue-100 text-blue-700',
    won_back: 'bg-green-100 text-green-700',
    dismissed: 'bg-red-100 text-red-700',
    moved_to_quoted: 'bg-cyan-100 text-cyan-700',
  };

  // Calculate total premium from policies
  const totalOldPremium = (record.policies || []).reduce(
    (sum, p) => sum + (p.premium_old_cents || 0),
    0
  );

  return (
    <Card className="bg-muted/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Badge
                  className={cn('text-xs', statusColors[record.status || ''] || 'bg-gray-100')}
                >
                  {(record.status || 'Unknown').replace(/_/g, ' ')}
                </Badge>
                {record.assigned_team_member_name && (
                  <span className="text-xs text-muted-foreground">
                    Assigned: {record.assigned_team_member_name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {record.earliest_winback_date && (
                  <span className="text-purple-600">
                    Eligible: {format(new Date(record.earliest_winback_date), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
              {/* Quick summary - use policy_count and premium from household */}
              <div className="flex items-center gap-4 text-xs mt-1">
                {(record.policy_count || 0) > 0 && (
                  <span className="text-purple-600">
                    {record.policy_count} terminated polic{record.policy_count !== 1 ? 'ies' : 'y'}
                  </span>
                )}
                {(record.total_premium_potential_cents || 0) > 0 && (
                  <span className="text-muted-foreground">
                    (${((record.total_premium_potential_cents || 0) / 100).toLocaleString()} potential)
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {hasDetails && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>

          {/* Expandable policies table - THE MAIN FIX */}
          <CollapsibleContent className="mt-3">
            <div>
              <h5 className="text-xs font-medium mb-1 text-purple-600">
                Terminated Policies ({record.policies?.length})
              </h5>
              <WinbackPoliciesTable policies={record.policies || []} />
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

export default SystemRecords;
