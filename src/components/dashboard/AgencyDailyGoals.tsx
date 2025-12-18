import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Home, ShoppingCart, Target } from 'lucide-react';

interface DailyProgress {
  quotedHouseholds: { current: number; target: number };
  soldItems: { current: number; target: number };
  date: string;
}

interface AgencyDailyGoalsProps {
  agencyId: string;
  date?: string;
  showDate?: boolean;
  variant?: 'large' | 'compact';
}

export function AgencyDailyGoals({ 
  agencyId, 
  date, 
  showDate = false,
  variant = 'large' 
}: AgencyDailyGoalsProps) {
  const [progress, setProgress] = useState<DailyProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-daily-agency-progress', {
          body: { agencyId, date },
        });

        if (error) throw error;
        setProgress(data);
      } catch (err) {
        console.error('Error fetching daily progress:', err);
      } finally {
        setLoading(false);
      }
    };

    if (agencyId) {
      fetchProgress();
      
      // Refresh every 30 seconds for real-time updates
      const interval = setInterval(fetchProgress, 30000);
      return () => clearInterval(interval);
    }
  }, [agencyId, date]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex gap-6 animate-pulse">
          <div className="flex-1 h-24 bg-muted rounded-lg" />
          <div className="flex-1 h-24 bg-muted rounded-lg" />
        </div>
      </Card>
    );
  }

  if (!progress) return null;

  const quotedPercent = Math.min(
    (progress.quotedHouseholds.current / progress.quotedHouseholds.target) * 100,
    100
  );
  const soldPercent = Math.min(
    (progress.soldItems.current / progress.soldItems.target) * 100,
    100
  );

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-green-500';
    if (percent >= 75) return 'bg-yellow-500';
    if (percent >= 50) return 'bg-orange-500';
    return 'bg-blue-500';
  };

  const getTextColor = (percent: number) => {
    if (percent >= 100) return 'text-green-500';
    if (percent >= 75) return 'text-yellow-500';
    if (percent >= 50) return 'text-orange-500';
    return 'text-blue-500';
  };

  return (
    <Card className="p-6">
      {showDate && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            {date 
              ? `Results for ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}` 
              : "Today's Progress"
            }
          </h3>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Quoted Households */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Home className="h-4 w-4 text-orange-500" />
              </div>
              <span className="font-medium">Quoted Households</span>
            </div>
            {quotedPercent >= 100 && (
              <span className="text-xs font-semibold text-green-500 bg-green-500/10 px-2 py-1 rounded-full">
                ✓ Goal Met!
              </span>
            )}
          </div>
          
          <div className="flex items-baseline justify-between">
            <div>
              <span className={`text-3xl font-bold ${getTextColor(quotedPercent)}`}>
                {progress.quotedHouseholds.current}
              </span>
              <span className="text-muted-foreground text-lg ml-1">
                / {progress.quotedHouseholds.target}
              </span>
            </div>
            <span className={`text-sm font-medium ${getTextColor(quotedPercent)}`}>
              {Math.round(quotedPercent)}%
            </span>
          </div>
          
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${getProgressColor(quotedPercent)}`}
              style={{ width: `${quotedPercent}%` }}
            />
          </div>
        </div>

        {/* Sold Items */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-500/10">
                <ShoppingCart className="h-4 w-4 text-green-500" />
              </div>
              <span className="font-medium">Sold Items</span>
            </div>
            {soldPercent >= 100 && (
              <span className="text-xs font-semibold text-green-500 bg-green-500/10 px-2 py-1 rounded-full">
                ✓ Goal Met!
              </span>
            )}
          </div>
          
          <div className="flex items-baseline justify-between">
            <div>
              <span className={`text-3xl font-bold ${getTextColor(soldPercent)}`}>
                {progress.soldItems.current}
              </span>
              <span className="text-muted-foreground text-lg ml-1">
                / {progress.soldItems.target}
              </span>
            </div>
            <span className={`text-sm font-medium ${getTextColor(soldPercent)}`}>
              {Math.round(soldPercent)}%
            </span>
          </div>
          
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${getProgressColor(soldPercent)}`}
              style={{ width: `${soldPercent}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
