import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, Flame, Heart, Brain, Scale, Briefcase, Zap } from 'lucide-react';
import { useStaffCore4Stats, Core4Domain } from '@/hooks/useStaffCore4Stats';
import { useStaffFlowStats } from '@/hooks/useStaffFlowStats';
import { cn } from '@/lib/utils';

const domains: { key: Core4Domain; label: string; icon: React.ElementType }[] = [
  { key: 'body', label: 'BODY', icon: Heart },
  { key: 'being', label: 'BEING', icon: Brain },
  { key: 'balance', label: 'BALANCE', icon: Scale },
  { key: 'business', label: 'BUSINESS', icon: Briefcase },
];

export function StaffCore4Card() {
  const { 
    todayEntry, 
    todayPoints, 
    weeklyPoints, 
    currentStreak, 
    loading, 
    toggleDomain 
  } = useStaffCore4Stats();

  const flowStats = useStaffFlowStats();

  // Combined weekly: Core 4 (max 28) + Flow (max 7) = 35
  const combinedWeeklyPoints = weeklyPoints + flowStats.weeklyProgress;
  const combinedWeeklyGoal = 35;

  const isDomainCompleted = (domain: Core4Domain): boolean => {
    if (!todayEntry) return false;
    return todayEntry[`${domain}_completed`] as boolean;
  };

  const handleToggle = async (domain: Core4Domain) => {
    await toggleDomain(domain);
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold">Core 4 + Flow</CardTitle>
            {currentStreak > 0 && (
              <div className="flex items-center gap-1 text-orange-500">
                <Flame className="h-4 w-4" />
                <span className="text-sm font-medium">{currentStreak}</span>
              </div>
            )}
          </div>
          <Link to="/staff/core4">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        
        {/* Stats row with combined score */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
          <span>Today: <span className="text-foreground font-medium">{todayPoints}/4</span></span>
          <span className="text-border">•</span>
          <span>Week: <span className="text-foreground font-medium">{combinedWeeklyPoints}/{combinedWeeklyGoal}</span></span>
          {flowStats.todayCompleted && (
            <>
              <span className="text-border">•</span>
              <span className="text-cyan-500 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Flow
              </span>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* 2x2 Grid of domain buttons */}
        <div className="grid grid-cols-2 gap-3">
          {domains.map(({ key, label, icon: Icon }) => {
            const completed = isDomainCompleted(key);
            return (
              <button
                key={key}
                onClick={() => handleToggle(key)}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-lg transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  completed
                    ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Icon className={cn("h-6 w-6", completed && "text-white")} />
                <span className={cn(
                  "text-xs font-semibold tracking-wide",
                  completed ? "text-white" : "text-muted-foreground"
                )}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
