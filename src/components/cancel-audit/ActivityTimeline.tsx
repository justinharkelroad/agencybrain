import { useMemo } from 'react';
import { 
  Phone, 
  Voicemail, 
  MessageSquare, 
  Mail, 
  MessageCircle, 
  DollarSign, 
  Handshake, 
  StickyNote,
  ClipboardList,
  Loader2
} from 'lucide-react';
import { ActivityType, CancelAuditActivity, ACTIVITY_LABELS, ACTIVITY_COLORS } from '@/types/cancel-audit';
import { format, isToday, isYesterday, formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface ActivityTimelineProps {
  activities: CancelAuditActivity[];
  isLoading?: boolean;
  householdKey: string;
  currentRecordId: string;
}

const ACTIVITY_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  attempted_call: Phone,
  voicemail_left: Voicemail,
  text_sent: MessageSquare,
  email_sent: Mail,
  spoke_with_client: MessageCircle,
  payment_made: DollarSign,
  payment_promised: Handshake,
  note: StickyNote,
};

function formatActivityTime(dateStr: string): string {
  const date = parseISO(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // If less than 24 hours ago, show relative time
  if (diffHours < 24) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  // Otherwise show time
  return format(date, 'h:mm a');
}

function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr);
  
  if (isToday(date)) {
    return 'Today';
  }
  
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  
  return format(date, 'MMM d, yyyy');
}

function groupActivitiesByDate(activities: CancelAuditActivity[]): Map<string, CancelAuditActivity[]> {
  const groups = new Map<string, CancelAuditActivity[]>();
  
  activities.forEach((activity) => {
    const dateKey = format(parseISO(activity.created_at), 'yyyy-MM-dd');
    const existing = groups.get(dateKey) || [];
    groups.set(dateKey, [...existing, activity]);
  });
  
  return groups;
}

function ActivityItem({ 
  activity, 
  isCurrentRecord 
}: { 
  activity: CancelAuditActivity; 
  isCurrentRecord: boolean;
}) {
  const Icon = ACTIVITY_ICONS[activity.activity_type as ActivityType] || StickyNote;
  const colorClass = ACTIVITY_COLORS[activity.activity_type as ActivityType] || ACTIVITY_COLORS.note;
  const label = ACTIVITY_LABELS[activity.activity_type as ActivityType] || activity.activity_type;

  return (
    <div 
      className={cn(
        'flex gap-3 p-3 rounded-lg border',
        colorClass,
        !isCurrentRecord && 'opacity-75'
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm">{label}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatActivityTime(activity.created_at)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          by {activity.user_display_name}
        </p>
        {activity.notes && (
          <p className="text-sm mt-2 text-foreground/80 italic">
            "{activity.notes}"
          </p>
        )}
      </div>
    </div>
  );
}

// Only these activity types count as actual contact attempts
const CONTACT_ACTIVITY_TYPES: ActivityType[] = [
  'attempted_call',
  'voicemail_left',
  'text_sent',
  'email_sent',
  'spoke_with_client',
];

export function ActivityTimeline({
  activities,
  isLoading = false,
  householdKey,
  currentRecordId,
}: ActivityTimelineProps) {
  const groupedActivities = useMemo(() => {
    return groupActivitiesByDate(activities);
  }, [activities]);

  // Count only actual contact attempts (not notes, payments, promises)
  const contactCount = useMemo(() => {
    return activities.filter(a => 
      CONTACT_ACTIVITY_TYPES.includes(a.activity_type as ActivityType)
    ).length;
  }, [activities]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">Activity History</h4>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">Activity History</h4>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No activity recorded yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Use the quick actions above to log your first contact
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">Activity History</h4>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {contactCount} {contactCount === 1 ? 'contact' : 'contacts'}
        </span>
      </div>

      <div className="space-y-6 max-h-[300px] overflow-y-auto pr-2">
        {Array.from(groupedActivities.entries()).map(([dateKey, dateActivities]) => (
          <div key={dateKey} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {formatDateHeader(dateActivities[0].created_at)}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-2">
              {dateActivities.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  isCurrentRecord={activity.record_id === currentRecordId}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
