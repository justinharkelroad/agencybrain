import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  ClipboardList, 
  Phone, 
  DollarSign, 
  Target,
  Users,
  Calendar
} from 'lucide-react';
import { useCancelAuditStats } from '@/hooks/useCancelAuditStats';
import { formatWeekRange, formatCurrencyShort } from '@/lib/cancel-audit-utils';
import { cn } from '@/lib/utils';

interface WeeklyStatsSummaryProps {
  agencyId: string;
  weekOffset: number;
  onWeekChange: (offset: number) => void;
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  mainValue: string | number;
  subItems?: { label: string; value: string | number }[];
  highlight?: string;
  highlightColor?: string;
}

function StatCard({ icon, title, mainValue, subItems, highlight, highlightColor = 'text-green-400' }: StatCardProps) {
  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{mainValue}</p>
      {subItems && (
        <div className="mt-2 space-y-1">
          {subItems.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {highlight && (
        <p className={cn('mt-2 text-sm font-medium', highlightColor)}>
          {highlight}
        </p>
      )}
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-8 w-24 mb-2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4 mt-1" />
    </Card>
  );
}

export function WeeklyStatsSummary({ agencyId, weekOffset, onWeekChange }: WeeklyStatsSummaryProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { data: stats, isLoading } = useCancelAuditStats({ agencyId, weekOffset });

  if (isLoading) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card className="p-6 bg-card border-border">
      {/* Header with week navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold text-foreground">
            Week of {formatWeekRange(stats.weekStart, stats.weekEnd)}
          </span>
          {weekOffset === 0 && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              Current Week
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onWeekChange(weekOffset - 1)}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          
          {weekOffset !== 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onWeekChange(0)}
            >
              Today
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onWeekChange(weekOffset + 1)}
            disabled={weekOffset >= 0}
            className="gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 ml-2"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<ClipboardList className="h-4 w-4" />}
              title="To Address"
              mainValue={`${stats.needsAttentionCount} Active`}
              subItems={[
                { label: 'Pending Cancel', value: stats.pendingCancelCount },
                { label: 'Cancelled', value: stats.cancellationCount },
              ]}
              highlight={`(${stats.totalRecords} total)`}
              highlightColor="text-muted-foreground"
            />

            <StatCard
              icon={<Phone className="h-4 w-4" />}
              title="Contacts"
              mainValue={`${stats.totalContacts} Made`}
              subItems={[
                { label: 'Households touched', value: stats.uniqueHouseholdsContacted },
              ]}
            />

            <StatCard
              icon={<DollarSign className="h-4 w-4" />}
              title="Wins"
              mainValue={`${stats.paymentsMade} Payments`}
              subItems={[
                { label: 'Promised', value: stats.paymentsPromised },
              ]}
              highlight={stats.premiumRecovered > 0 ? `${formatCurrencyShort(stats.premiumRecovered)} saved` : undefined}
              highlightColor="text-green-400"
            />

            <StatCard
              icon={<Target className="h-4 w-4" />}
              title="Coverage"
              mainValue={`${stats.coveragePercent}%`}
              subItems={[
                { label: 'Contacted', value: `${stats.uniqueHouseholdsContacted} of ${stats.totalRecords}` },
              ]}
            />
          </div>

          {/* Team Activity Row */}
          {stats.byTeamMember.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Weekly Team Activity:</span>
                <div className="flex flex-wrap gap-1">
                  {stats.byTeamMember.slice(0, 5).map((member, i) => (
                    <span key={member.name} className="text-foreground">
                      {member.name} ({member.contacts})
                      {i < Math.min(stats.byTeamMember.length - 1, 4) && ','}
                    </span>
                  ))}
                  {stats.byTeamMember.length > 5 && (
                    <span className="text-muted-foreground">
                      +{stats.byTeamMember.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {stats.totalContacts === 0 && stats.paymentsMade === 0 && stats.totalRecords > 0 && (
            <div className="mt-4 pt-4 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">
                No activity recorded this week yet. Start making contacts!
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}