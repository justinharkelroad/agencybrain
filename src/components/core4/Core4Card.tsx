import { useCore4Stats, Core4Domain } from '@/hooks/useCore4Stats';
import { useFlowStats } from '@/hooks/useFlowStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dumbbell, Brain, Heart, Briefcase, Flame, ChevronRight, Loader2, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const domains: { key: Core4Domain; label: string; icon: typeof Dumbbell }[] = [
  { key: 'body', label: 'BODY', icon: Dumbbell },
  { key: 'being', label: 'BEING', icon: Brain },
  { key: 'balance', label: 'BALANCE', icon: Heart },
  { key: 'business', label: 'BUSINESS', icon: Briefcase },
];

export function Core4Card() {
  const { 
    todayEntry, 
    todayPoints, 
    weeklyPoints, 
    currentStreak,
    longestStreak,
    loading, 
    toggleDomain 
  } = useCore4Stats();

  const flowStats = useFlowStats();

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
          <Link to="/core4">
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
              <span className="text-purple-500 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Flow
              </span>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
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

        {/* THE SCORE + THE STREAKS Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* THE SCORE */}
          <div className="bg-muted/30 rounded-xl p-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-3">The Score</p>
            <div className="relative w-20 h-20 mx-auto mb-3">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="3"
                />
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(combinedWeeklyPoints / combinedWeeklyGoal) * 97.4} 97.4`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{combinedWeeklyPoints}</span>
                <span className="text-[10px] text-muted-foreground">/35</span>
              </div>
            </div>
            <div className="flex justify-center gap-3 text-xs text-muted-foreground">
              <span>Core 4: <span className="text-foreground font-medium">{weeklyPoints}/28</span></span>
              <span>Flow: <span className="text-foreground font-medium">{flowStats.weeklyProgress}/7</span></span>
            </div>
          </div>

          {/* THE STREAKS */}
          <div className="bg-muted/30 rounded-xl p-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-3">The Streaks</p>
            <div className="flex justify-center gap-4 mb-3">
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-purple-500" />
                </div>
                <span className="text-xl font-bold">{flowStats.currentStreak}</span>
                <span className="text-[10px] text-muted-foreground">Flow</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <span className="text-xl font-bold">{currentStreak}</span>
                <span className="text-[10px] text-muted-foreground">Core 4</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Longest: Flow {flowStats.longestStreak} | Core {longestStreak}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
