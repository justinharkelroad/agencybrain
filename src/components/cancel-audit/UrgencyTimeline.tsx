import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock } from 'lucide-react';
import { differenceInDays, startOfDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface UrgencyTimelineProps {
  records: Array<{
    id: string;
    pending_cancel_date?: string | null;
    cancel_date?: string | null;
    status?: string;
  }>;
  onFilterByUrgency: (urgency: string | null) => void;
  activeUrgencyFilter: string | null;
}

interface UrgencyBucket {
  key: string;
  label: string;
  count: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

export function UrgencyTimeline({ 
  records, 
  onFilterByUrgency, 
  activeUrgencyFilter 
}: UrgencyTimelineProps) {
  
  const urgencyBuckets = useMemo(() => {
    const today = startOfDay(new Date());
    
    // Only count records that are still being worked (not resolved/lost)
    const workingRecords = records.filter(r => 
      r.status !== 'resolved' && r.status !== 'lost'
    );
    
    const buckets: UrgencyBucket[] = [
      { key: 'overdue', label: 'RED ALERT', count: 0, color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500' },
      { key: 'tomorrow', label: 'Tomorrow', count: 0, color: 'text-orange-400', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-500' },
      { key: '3days', label: '3 Days', count: 0, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500' },
      { key: '7days', label: '7 Days', count: 0, color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500' },
      { key: '14days', label: '14 Days', count: 0, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', borderColor: 'border-cyan-500' },
      { key: 'beyond', label: '21+ Days', count: 0, color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500' },
    ];
    
    workingRecords.forEach(record => {
      // Use pending_cancel_date or cancel_date
      const dateStr = record.pending_cancel_date || record.cancel_date;
      if (!dateStr) return;
      
      const cancelDate = startOfDay(parseISO(dateStr));
      const daysUntil = differenceInDays(cancelDate, today);
      
      if (daysUntil < 0) {
        // Past due - RED ALERT
        buckets[0].count++;
      } else if (daysUntil === 0) {
        // Today counts as RED ALERT too (due today)
        buckets[0].count++;
      } else if (daysUntil === 1) {
        // Tomorrow
        buckets[1].count++;
      } else if (daysUntil <= 3) {
        // 2-3 days
        buckets[2].count++;
      } else if (daysUntil <= 7) {
        // 4-7 days
        buckets[3].count++;
      } else if (daysUntil <= 14) {
        // 8-14 days
        buckets[4].count++;
      } else {
        // 15+ days
        buckets[5].count++;
      }
    });
    
    return buckets;
  }, [records]);
  
  const totalWorking = urgencyBuckets.reduce((sum, b) => sum + b.count, 0);
  
  const handleBucketClick = (key: string) => {
    if (activeUrgencyFilter === key) {
      onFilterByUrgency(null); // Toggle off
    } else {
      onFilterByUrgency(key);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Urgency Timeline</CardTitle>
          {activeUrgencyFilter && (
            <button
              onClick={() => onFilterByUrgency(null)}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {urgencyBuckets.map((bucket) => (
            <button
              key={bucket.key}
              onClick={() => handleBucketClick(bucket.key)}
              disabled={bucket.count === 0}
              className={cn(
                "flex flex-col items-center justify-center px-2 py-3 rounded-lg border-2 transition-all w-full",
                bucket.bgColor,
                bucket.count === 0 ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-80",
                activeUrgencyFilter === bucket.key 
                  ? `${bucket.borderColor} ring-2 ring-offset-2 ring-offset-background ring-primary/30` 
                  : "border-transparent"
              )}
            >
              {bucket.key === 'overdue' && bucket.count > 0 && (
                <AlertTriangle className="h-4 w-4 text-red-400 animate-pulse mb-1" />
              )}
              <span className={cn("text-xl font-bold", bucket.color)}>
                {bucket.count}
              </span>
              <span className={cn("text-xs", bucket.color)}>
                {bucket.label}
              </span>
            </button>
          ))}
        </div>
        
        {/* Progress bar showing distribution */}
        {totalWorking > 0 && (
          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden flex">
              {urgencyBuckets.map((bucket) => (
                bucket.count > 0 && (
                  <div
                    key={bucket.key}
                    className={cn(
                      "h-full transition-all",
                  bucket.key === 'overdue' && "bg-red-500",
                  bucket.key === 'tomorrow' && "bg-orange-500",
                  bucket.key === '3days' && "bg-yellow-500",
                  bucket.key === '7days' && "bg-blue-500",
                  bucket.key === '14days' && "bg-cyan-500",
                  bucket.key === 'beyond' && "bg-gray-400"
                    )}
                    style={{ width: `${(bucket.count / totalWorking) * 100}%` }}
                  />
                )
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
