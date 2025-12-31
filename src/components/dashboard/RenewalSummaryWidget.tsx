import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronRight, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRenewalStats } from "@/hooks/useRenewalRecords";
import { Skeleton } from "@/components/ui/skeleton";

interface RenewalSummaryWidgetProps {
  agencyId: string | null;
}

export function RenewalSummaryWidget({ agencyId }: RenewalSummaryWidgetProps) {
  const navigate = useNavigate();
  
  // Get stats for next 7 days
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const { data: stats, isLoading } = useRenewalStats(agencyId, {
    start: today.toISOString().slice(0, 10),
    end: nextWeek.toISOString().slice(0, 10),
  });

  if (!agencyId) return null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Renewals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = stats?.total || 0;
  const uncontacted = stats?.uncontacted || 0;
  const pending = stats?.pending || 0;
  const successRate = total > 0 
    ? Math.round(((stats?.success || 0) / total) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Renewals (Next 7 Days)</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/renewals')}>
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Main stat */}
          <div className="text-center">
            <span className="text-4xl font-bold">{total}</span>
            <p className="text-sm text-muted-foreground">renewals upcoming</p>
          </div>
          
          {/* Status breakdown */}
          <div className="flex flex-wrap justify-center gap-3">
            {uncontacted > 0 && (
              <Badge variant="secondary" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {uncontacted} uncontacted
              </Badge>
            )}
            {pending > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                {pending} pending
              </Badge>
            )}
            {successRate > 0 && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {successRate}% retained
              </Badge>
            )}
          </div>

          {/* Bundled vs Monoline mini bar */}
          {total > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Bundled: {stats?.bundled || 0}</span>
                <span>Monoline: {stats?.monoline || 0}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all"
                  style={{ width: `${total > 0 ? ((stats?.bundled || 0) / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
