import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { Phone, Mail, FileText, Calendar, CheckCircle, XCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ContactActivity, SourceModule, ContactActivityType } from '@/types/contact';
import { SOURCE_MODULE_CONFIGS } from '@/types/contact';
import { cn } from '@/lib/utils';

interface ActivityTimelineProps {
  activities: ContactActivity[];
  maxHeight?: string;
  showSourceTags?: boolean;
  filterBySource?: SourceModule;
}

export function ActivityTimeline({
  activities,
  maxHeight = '400px',
  showSourceTags = true,
  filterBySource,
}: ActivityTimelineProps) {
  // Filter by source if specified
  const filteredActivities = filterBySource
    ? activities.filter(a => a.source_module === filterBySource)
    : activities;

  // Group activities by date
  const groupedActivities = groupActivitiesByDate(filteredActivities);

  if (filteredActivities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
        <p>No activity recorded yet</p>
      </div>
    );
  }

  return (
    <ScrollArea style={{ maxHeight }} className="pr-4">
      <div className="space-y-6">
        {Object.entries(groupedActivities).map(([dateKey, dayActivities]) => (
          <div key={dateKey}>
            <div className="sticky top-0 bg-background/95 backdrop-blur py-1 mb-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                {formatDateHeader(dateKey)}
              </h4>
            </div>
            <div className="space-y-3">
              {dayActivities.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  showSourceTag={showSourceTags}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

interface ActivityItemProps {
  activity: ContactActivity;
  showSourceTag: boolean;
}

function ActivityItem({ activity, showSourceTag }: ActivityItemProps) {
  const sourceConfig = SOURCE_MODULE_CONFIGS[activity.source_module as SourceModule];
  const Icon = getActivityIcon(activity.activity_type);

  return (
    <div className="relative pl-6 pb-3 border-l-2 border-muted last:pb-0">
      {/* Timeline dot */}
      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-background border-2 border-muted flex items-center justify-center">
        <div className={cn(
          'w-2 h-2 rounded-full',
          getActivityDotColor(activity.activity_type)
        )} />
      </div>

      <div className="bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">
              {formatActivityTitle(activity)}
            </span>
          </div>
          {showSourceTag && sourceConfig && (
            <Badge
              variant="outline"
              className={cn(
                'text-xs shrink-0',
                sourceConfig.color,
                sourceConfig.bgColor
              )}
            >
              {sourceConfig.icon} {sourceConfig.label}
            </Badge>
          )}
        </div>

        {/* Outcome badge if present */}
        {activity.outcome && (
          <div className="mb-2">
            <Badge variant="secondary" className="text-xs">
              {formatOutcome(activity.outcome)}
            </Badge>
          </div>
        )}

        {/* Notes/content */}
        {activity.notes && (
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
            {activity.notes}
          </p>
        )}

        {/* Footer with time and author */}
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>{format(new Date(activity.activity_date), 'h:mm a')}</span>
          {activity.created_by_display_name && (
            <span>- {activity.created_by_display_name}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function groupActivitiesByDate(activities: ContactActivity[]): Record<string, ContactActivity[]> {
  const groups: Record<string, ContactActivity[]> = {};

  activities.forEach(activity => {
    const dateKey = format(new Date(activity.activity_date), 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(activity);
  });

  return groups;
}

function formatDateHeader(dateKey: string): string {
  // Append T00:00:00 to parse as local time, not UTC
  // Without this, 'YYYY-MM-DD' is treated as UTC midnight which shifts back a day in US timezones
  const date = new Date(dateKey + 'T00:00:00');

  if (isToday(date)) {
    return 'Today';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }

  return format(date, 'MMMM d, yyyy');
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'call':
    case 'voicemail':
      return Phone;
    case 'email':
      return Mail;
    case 'appointment':
      return Calendar;
    case 'note':
      return FileText;
    case 'text':
      return MessageSquare;
    case 'policy_sold':
    case 'policy_renewed':
    case 'account_saved':
      return CheckCircle;
    case 'policy_cancelled':
      return XCircle;
    case 'status_change':
      return AlertCircle;
    default:
      return FileText;
  }
}

function getActivityDotColor(type: string): string {
  switch (type) {
    case 'call':
    case 'voicemail':
      return 'bg-blue-500';
    case 'email':
      return 'bg-purple-500';
    case 'appointment':
      return 'bg-yellow-500';
    case 'note':
      return 'bg-gray-500';
    case 'policy_sold':
    case 'policy_renewed':
    case 'account_saved':
      return 'bg-green-500';
    case 'policy_cancelled':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
}

function formatActivityTitle(activity: ContactActivity): string {
  const type = activity.activity_type;
  const direction = activity.call_direction;

  switch (type) {
    case 'call':
      return direction === 'inbound' ? 'Inbound Call' : 'Outbound Call';
    case 'voicemail':
      return 'Voicemail';
    case 'email':
      return activity.subject || 'Email';
    case 'appointment':
      return activity.subject || 'Appointment';
    case 'note':
      return activity.subject || 'Note';
    case 'text':
      return 'Text Message';
    case 'policy_sold':
      return 'Policy Sold';
    case 'policy_renewed':
      return 'Policy Renewed';
    case 'policy_cancelled':
      return 'Policy Cancelled';
    case 'account_saved':
      return 'Account Saved';
    case 'status_change':
      return 'Status Changed';
    case 'call_scored':
      return 'Call Scored';
    default:
      return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

function formatOutcome(outcome: string): string {
  return outcome
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

export default ActivityTimeline;
