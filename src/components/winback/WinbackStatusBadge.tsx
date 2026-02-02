import { cn } from '@/lib/utils';

export type WinbackStatusType = 'untouched' | 'in_progress' | 'won_back' | 'dismissed' | 'moved_to_quoted' | 'declined' | 'no_contact';

interface WinbackStatusBadgeProps {
  status: WinbackStatusType;
  className?: string;
}

const statusConfig: Record<WinbackStatusType, { label: string; className: string }> = {
  untouched: {
    label: 'Untouched',
    className: 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  won_back: {
    label: 'Won Back',
    className: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
  },
  dismissed: {
    label: 'Dismissed',
    className: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
  },
  moved_to_quoted: {
    label: 'Moved to Quoted',
    className: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  declined: {
    label: 'Declined',
    className: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30',
  },
  no_contact: {
    label: 'No Contact',
    className: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
  },
};

export function WinbackStatusBadge({ status, className }: WinbackStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.untouched;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}