import { CheckCircle2, Circle, AlertCircle, Loader2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
}

export function SaveStatusIndicator({ status, lastSaved, hasUnsavedChanges }: SaveStatusIndicatorProps) {
  const getStatusDisplay = () => {
    if (status === 'saving') {
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        text: 'Saving...',
        color: 'text-muted-foreground',
      };
    }

    if (status === 'error') {
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        text: 'Save failed',
        color: 'text-destructive',
      };
    }

    if (hasUnsavedChanges) {
      return {
        icon: <Circle className="h-4 w-4" />,
        text: 'Unsaved changes',
        color: 'text-warning',
      };
    }

    if (status === 'saved' && lastSaved) {
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        text: `Saved ${formatDistanceToNow(lastSaved, { addSuffix: true })}`,
        color: 'text-success',
      };
    }

    return {
      icon: <Circle className="h-4 w-4" />,
      text: 'No changes',
      color: 'text-muted-foreground',
    };
  };

  const { icon, text, color } = getStatusDisplay();

  return (
    <div className={cn(
      "flex items-center gap-2 text-sm transition-colors",
      color
    )}>
      {icon}
      <span>{text}</span>
      {lastSaved && status !== 'saving' && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}
