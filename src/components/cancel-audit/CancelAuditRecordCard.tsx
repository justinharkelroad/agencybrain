import { ChevronDown, Phone, Mail, User, FileText, Calendar, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { RecordWithActivityCount } from '@/hooks/useCancelAuditRecords';
import { StatusIndicator, StatusBadge } from './StatusIndicator';
import { ActivityBadge } from './ActivityBadge';
import { 
  formatCentsToCurrency, 
  formatDate, 
  formatDateShort,
  getDisplayName,
  formatPhone 
} from '@/lib/cancel-audit-utils';

interface CancelAuditRecordCardProps {
  record: RecordWithActivityCount;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function CancelAuditRecordCard({
  record,
  isExpanded,
  onToggleExpand,
}: CancelAuditRecordCardProps) {
  const displayName = getDisplayName(record.insured_first_name, record.insured_last_name);
  const primaryDate = record.pending_cancel_date || record.cancel_date;
  const primaryDateLabel = record.report_type === 'pending_cancel' ? 'Pending' : 'Cancelled';

  return (
    <Card
      className={cn(
        'transition-all duration-200 cursor-pointer overflow-hidden',
        isExpanded 
          ? 'border-2 border-primary/30 bg-card' 
          : 'border border-border bg-card hover:border-border/80'
      )}
      onClick={onToggleExpand}
    >
      {/* Collapsed Header - Always visible */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Status indicator */}
          <div className="flex-shrink-0">
            <StatusIndicator record={record} />
          </div>

          {/* Name */}
          <div className="min-w-0 flex-1 sm:flex-none sm:w-48">
            <p className="font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground">Policy</p>
          </div>

          {/* Policy Number */}
          <div className="hidden sm:block w-28">
            <p className="font-mono text-sm text-foreground">{record.policy_number}</p>
          </div>

          {/* Product */}
          <div className="hidden md:block w-24">
            <p className="text-sm text-foreground truncate">{record.product_name || '--'}</p>
          </div>

          {/* Date */}
          <div className="hidden sm:block w-28 text-right">
            <p className="text-sm text-foreground">{formatDateShort(primaryDate)}</p>
            <p className="text-xs text-muted-foreground">{primaryDateLabel}</p>
          </div>

          {/* Premium */}
          <div className="hidden md:block w-24 text-right">
            <p className="text-sm font-medium text-foreground">
              {formatCentsToCurrency(record.premium_cents)}
            </p>
          </div>

          {/* Activity badge */}
          <div className="hidden lg:block flex-shrink-0">
            <ActivityBadge 
              activityCount={record.activity_count} 
              lastActivityAt={record.last_activity_at} 
            />
          </div>

          {/* Expand chevron */}
          <div className="flex-shrink-0 ml-auto">
            <ChevronDown 
              className={cn(
                'h-5 w-5 text-muted-foreground transition-transform duration-200',
                isExpanded && 'rotate-180'
              )}
            />
          </div>
        </div>

        {/* Mobile-only: show key info on second row */}
        <div className="flex items-center gap-4 mt-2 sm:hidden">
          <span className="font-mono text-xs text-muted-foreground">{record.policy_number}</span>
          <span className="text-xs text-muted-foreground">{formatDateShort(primaryDate)}</span>
          <span className="text-xs font-medium">{formatCentsToCurrency(record.premium_cents)}</span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div 
          className="px-4 pb-4 border-t border-border"
          onClick={(e) => e.stopPropagation()} // Prevent collapsing when interacting with content
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
            {/* Contact Section */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Contact
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  {record.insured_phone ? (
                    <a 
                      href={`tel:${record.insured_phone}`}
                      className="text-primary hover:underline"
                    >
                      {formatPhone(record.insured_phone)}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </div>
                {record.insured_phone_alt && (
                  <div>
                    <span className="text-muted-foreground">Alt: </span>
                    <a 
                      href={`tel:${record.insured_phone_alt}`}
                      className="text-primary hover:underline"
                    >
                      {formatPhone(record.insured_phone_alt)}
                    </a>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  {record.insured_email ? (
                    <a 
                      href={`mailto:${record.insured_email}`}
                      className="text-primary hover:underline break-all"
                    >
                      {record.insured_email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </div>
              </div>
            </div>

            {/* Policy Details Section */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Policy Details
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Agent #: </span>
                  <span className="text-foreground">{record.agent_number || '--'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Items: </span>
                  <span className="text-foreground">{record.no_of_items || '--'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Type: </span>
                  <span className="text-foreground">{record.account_type || '--'}</span>
                </div>
              </div>
            </div>

            {/* Dates Section */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Dates
              </h4>
              <div className="space-y-2 text-sm">
                {record.pending_cancel_date && (
                  <div>
                    <span className="text-muted-foreground">Pending Cancel: </span>
                    <span className="text-foreground">{formatDate(record.pending_cancel_date)}</span>
                  </div>
                )}
                {record.cancel_date && (
                  <div>
                    <span className="text-muted-foreground">Cancel Date: </span>
                    <span className="text-foreground">{formatDate(record.cancel_date)}</span>
                  </div>
                )}
                {record.renewal_effective_date && (
                  <div>
                    <span className="text-muted-foreground">Renewal Date: </span>
                    <span className="text-foreground">{formatDate(record.renewal_effective_date)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Financials Section */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Financials
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Premium: </span>
                  <span className="text-foreground font-medium">
                    {formatCentsToCurrency(record.premium_cents)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount Due: </span>
                  <span className="text-foreground">
                    {formatCentsToCurrency(record.amount_due_cents)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status and Actions Row */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Status:</span>
              <StatusBadge status={record.status} />
            </div>

            <div className="flex items-center gap-2">
              <ActivityBadge 
                activityCount={record.activity_count} 
                lastActivityAt={record.last_activity_at} 
              />
            </div>
          </div>

          {/* Quick Actions Placeholder */}
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-dashed border-border">
            <p className="text-xs text-muted-foreground text-center">
              Quick Actions coming in Phase 4
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
