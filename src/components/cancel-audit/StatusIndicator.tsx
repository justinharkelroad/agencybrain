import { cn } from '@/lib/utils';
import { getUrgencyLevel, getDaysUntil } from '@/lib/cancel-audit-utils';
import { CancelAuditRecord, RecordStatus } from '@/types/cancel-audit';

interface StatusIndicatorProps {
  record: CancelAuditRecord;
  showStatusBadge?: boolean;
}

export function StatusIndicator({ record, showStatusBadge = false }: StatusIndicatorProps) {
  const urgency = getUrgencyLevel(record);
  const daysUntil = record.pending_cancel_date ? getDaysUntil(record.pending_cancel_date) : null;
  
  // Display the actual cancel_status from Excel (Cancel vs Cancelled)
  const cancelStatusLabel = record.cancel_status || (record.report_type === 'pending_cancel' ? 'Cancel' : 'Cancelled');
  const isSavable = cancelStatusLabel.toLowerCase() === 'cancel';

  const urgencyColors = {
    critical: 'bg-red-500',
    warning: 'bg-yellow-500',
    cancelled: isSavable ? 'bg-yellow-500' : 'bg-red-400',
    normal: 'bg-green-500',
  };

  const urgencyLabels = {
    critical: daysUntil === 0 ? 'Today!' : `${Math.abs(daysUntil || 0)}d overdue`,
    warning: `${daysUntil}d left`,
    cancelled: cancelStatusLabel,
    normal: daysUntil ? `${daysUntil}d left` : '',
  };

  return (
    <div className="flex items-center gap-2">
      {/* Urgency dot */}
      <div className="relative flex items-center">
        <span 
          className={cn(
            'h-2.5 w-2.5 rounded-full',
            urgencyColors[urgency]
          )}
        />
        {urgency === 'critical' && (
          <span 
            className={cn(
              'absolute h-2.5 w-2.5 rounded-full animate-ping',
              urgencyColors[urgency],
              'opacity-75'
            )}
          />
        )}
      </div>

      {/* Urgency label */}
      {urgencyLabels[urgency] && (
        <span className={cn(
          'text-xs font-medium',
          urgency === 'critical' && 'text-red-500',
          urgency === 'warning' && 'text-yellow-500',
          urgency === 'cancelled' && 'text-red-400',
          urgency === 'normal' && 'text-green-500'
        )}>
          {urgencyLabels[urgency]}
        </span>
      )}

      {/* Status badge */}
      {showStatusBadge && <StatusBadge status={record.status} />}
    </div>
  );
}

interface StatusBadgeProps {
  status: RecordStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<RecordStatus, { label: string; className: string }> = {
    new: {
      label: 'New',
      className: 'bg-muted text-muted-foreground',
    },
    in_progress: {
      label: 'Working',
      className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    },
    resolved: {
      label: 'Resolved',
      className: 'bg-green-500/10 text-green-400 border border-green-500/20',
    },
    lost: {
      label: 'Lost',
      className: 'bg-red-500/10 text-red-400 border border-red-500/20',
    },
  };

  const config = statusConfig[status];

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
      config.className
    )}>
      {config.label}
    </span>
  );
}
