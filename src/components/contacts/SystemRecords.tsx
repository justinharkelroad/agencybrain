import { format } from 'date-fns';
import { ChevronRight, FileText, RefreshCw, AlertTriangle, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
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

// Section wrapper
function RecordSection({
  title,
  icon,
  iconBg,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('p-1.5 rounded', iconBg)}>{icon}</div>
        <h4 className="text-sm font-medium">{title}</h4>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// Individual record cards
function LQSRecordCard({
  record,
  onView,
}: {
  record: LinkedLQSRecord;
  onView?: () => void;
}) {
  return (
    <Card className="bg-muted/30">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant={record.status === 'sold' || record.status === 'Sold' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {record.status || 'Quoted'}
              </Badge>
              {record.quoted_premium && (
                <span className="text-sm text-muted-foreground">
                  ${record.quoted_premium.toLocaleString()}/yr
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {record.team_member_name && <span>Agent: {record.team_member_name}</span>}
              {record.created_at && (
                <span className="ml-2">
                  Created: {format(new Date(record.created_at), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
          {onView && (
            <Button variant="ghost" size="sm" onClick={onView}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{record.policy_number}</span>
              <Badge
                className={cn('text-xs', statusColors[record.current_status] || 'bg-gray-100')}
              >
                {record.current_status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              <span>Due: {format(new Date(record.renewal_effective_date), 'MMM d, yyyy')}</span>
              {record.premium_new && (
                <span className="ml-2">${record.premium_new.toLocaleString()}/yr</span>
              )}
              {record.assigned_team_member_name && (
                <span className="ml-2">Assigned: {record.assigned_team_member_name}</span>
              )}
            </div>
          </div>
          {onView && (
            <Button variant="ghost" size="sm" onClick={onView}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                className={cn('text-xs', statusColors[record.cancel_status || ''] || 'bg-gray-100')}
              >
                {record.cancel_status || 'Unknown'}
              </Badge>
              {record.cancel_reason && (
                <span className="text-xs text-muted-foreground">
                  Reason: {record.cancel_reason}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {record.assigned_team_member_name && (
                <span>Assigned: {record.assigned_team_member_name}</span>
              )}
              {record.created_at && (
                <span className="ml-2">
                  Created: {format(new Date(record.created_at), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
          {onView && (
            <Button variant="ghost" size="sm" onClick={onView}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WinbackRecordCard({
  record,
  onView,
}: {
  record: LinkedWinbackRecord;
  onView?: () => void;
}) {
  const statusColors: Record<string, string> = {
    untouched: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    teed_up_this_week: 'bg-blue-100 text-blue-700',
    won_back: 'bg-green-100 text-green-700',
    dismissed: 'bg-red-100 text-red-700',
  };

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                className={cn('text-xs', statusColors[record.status || ''] || 'bg-gray-100')}
              >
                {(record.status || 'Unknown').replace(/_/g, ' ')}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {record.termination_date && (
                <span>
                  Terminated: {format(new Date(record.termination_date), 'MMM d, yyyy')}
                </span>
              )}
              {record.earliest_winback_date && (
                <span className="ml-2">
                  Eligible: {format(new Date(record.earliest_winback_date), 'MMM d, yyyy')}
                </span>
              )}
              {record.assigned_team_member_name && (
                <span className="ml-2">Assigned: {record.assigned_team_member_name}</span>
              )}
            </div>
          </div>
          {onView && (
            <Button variant="ghost" size="sm" onClick={onView}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default SystemRecords;
