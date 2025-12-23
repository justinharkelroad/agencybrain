import { useStaffCore4StatsExtended, Core4Domain } from '@/hooks/useStaffCore4StatsExtended';
import { useStaffFlowStats } from '@/hooks/useStaffFlowStats';
import { StaffCore4MonthlyMissions } from '@/components/staff/StaffCore4MonthlyMissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dumbbell, Brain, Heart, Briefcase, Flame, ChevronLeft, ChevronRight, 
  Loader2, Zap
} from 'lucide-react';
import { format, addDays, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { SmartBackButton } from '@/components/SmartBackButton';

const domains: { key: Core4Domain; label: string; icon: typeof Dumbbell; color: string }[] = [
  { key: 'body', label: 'BODY', icon: Dumbbell, color: 'from-green-500 to-emerald-600' },
  { key: 'being', label: 'BEING', icon: Brain, color: 'from-purple-500 to-violet-600' },
  { key: 'balance', label: 'BALANCE', icon: Heart, color: 'from-pink-500 to-rose-600' },
  { key: 'business', label: 'BUSINESS', icon: Briefcase, color: 'from-blue-500 to-indigo-600' },
];

// Circular progress component
function CircularProgress({ 
  value, 
  max, 
  size = 128, 
  strokeWidth = 8, 
  color = 'text-primary',
  label,
  sublabel
}: { 
  value: number; 
  max: number; 
  size?: number; 
  strokeWidth?: number; 
  color?: string;
  label?: string;
  sublabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = max > 0 ? Math.min(value / max, 1) : 0;
  const strokeDasharray = `${progress * circumference} ${circumference}`;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          className={`${color} transition-all duration-500`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs text-muted-foreground">/ {max}</span>
        {label && <span className="text-xs text-muted-foreground mt-1">{label}</span>}
      </div>
    </div>
  );
}

export default function StaffCore4() {
  const {
    todayEntry,
    todayPoints,
    weeklyPoints,
    weeklyGoal,
    currentStreak,
    longestStreak,
    totalPoints,
    weeklyActivity,
    loading,
    toggleDomain,
    selectedDate,
    setSelectedDate,
    selectedWeekStart,
    navigateWeek,
  } = useStaffCore4StatsExtended();

  const flowStats = useStaffFlowStats();

  // Combined stats (Core 4 = 28 max, Flow = 7 max, Total = 35 max)
  const combinedWeeklyPoints = weeklyPoints + flowStats.weeklyProgress;
  const combinedWeeklyGoal = 35; // 28 Core 4 + 7 Flow
  const combinedTotalPoints = totalPoints + flowStats.totalFlows;

  const isDomainCompleted = (domain: Core4Domain): boolean => {
    if (!todayEntry) return false;
    return todayEntry[`${domain}_completed`] as boolean;
  };

  const handleToggle = async (domain: Core4Domain) => {
    await toggleDomain(domain);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SmartBackButton />
            <div>
              <h1 className="text-xl font-bold">Core 4 + Flow</h1>
              <p className="text-sm text-muted-foreground">Daily habits tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-lg font-bold">{combinedWeeklyPoints} / {combinedWeeklyGoal}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Week Navigator */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="font-medium">
                {format(selectedWeekStart, 'MMM d')} - {format(addDays(selectedWeekStart, 6), 'MMM d, yyyy')}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigateWeek('next')}
                disabled={addDays(selectedWeekStart, 7) > new Date()}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {weeklyActivity.map((day) => (
                <button
                  key={day.dateStr}
                  onClick={() => setSelectedDate(day.date)}
                  className={cn(
                    "flex flex-col items-center p-2 rounded-lg transition-all",
                    day.isToday && "ring-2 ring-primary",
                    day.points === 4 && "bg-gradient-to-br from-cyan-500/20 to-blue-600/20",
                    day.isFuture && "opacity-40"
                  )}
                >
                  <span className="text-xs text-muted-foreground">{day.dayLabel}</span>
                  <span className={cn(
                    "text-lg font-bold",
                    day.points === 4 ? "text-cyan-500" : day.points > 0 ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {day.points}
                  </span>
                  {day.points === 4 && <Flame className="h-3 w-3 text-orange-500" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Today's Date Display */}
        <div className="text-center">
          <p className="text-2xl font-bold">
            {format(selectedDate, 'EEEE, MMMM do yyyy')}
          </p>
          {!isToday(selectedDate) && (
            <Button 
              variant="link" 
              className="text-primary"
              onClick={() => setSelectedDate(new Date())}
            >
              Go to Today
            </Button>
          )}
        </div>

        {/* Main Content - 2 column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Domain Buttons */}
          <div className="grid grid-cols-2 gap-4">
            {domains.map(({ key, label, icon: Icon, color }) => {
              const completed = isDomainCompleted(key);
              return (
                <button
                  key={key}
                  onClick={() => handleToggle(key)}
                  disabled={!isToday(selectedDate)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 p-8 rounded-xl transition-all duration-300",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50",
                    completed
                      ? `bg-gradient-to-br ${color} text-white shadow-xl scale-[1.02]`
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                    !isToday(selectedDate) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Icon className={cn("h-10 w-10", completed && "text-white")} />
                  <span className={cn(
                    "text-sm font-bold tracking-wider",
                    completed ? "text-white" : "text-muted-foreground"
                  )}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: Status Display */}
          <div className="flex flex-col items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-8xl">
                {todayPoints === 4 ? '🔥' : '🧘'}
              </div>
              <div>
                <p className="text-4xl font-bold">{todayPoints}/4</p>
                <p className="text-muted-foreground">Today's Core 4</p>
              </div>
              {flowStats.todayCompleted && (
                <div className="flex items-center justify-center gap-2 text-cyan-500">
                  <Zap className="h-5 w-5" />
                  <span className="text-sm font-medium">Flow completed today!</span>
                </div>
              )}
              {currentStreak > 0 && (
                <div className="flex items-center justify-center gap-2 text-orange-500">
                  <Flame className="h-6 w-6" />
                  <span className="text-xl font-bold">{currentStreak} day streak!</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Section - Combined Score Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Combined Weekly Score */}
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">THE SCORE</p>
              <div className="flex justify-center mb-3">
                <CircularProgress 
                  value={combinedWeeklyPoints} 
                  max={combinedWeeklyGoal}
                  color="text-primary"
                />
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span>Core: {weeklyPoints}/28</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Flow: {flowStats.weeklyProgress}/7</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Streaks */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-4 text-center">THE STREAKS</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                  <p className="text-xl font-bold">{currentStreak}</p>
                  <p className="text-xs text-muted-foreground">Core 4</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Zap className="h-5 w-5 mx-auto mb-1 text-cyan-500" />
                  <p className="text-xl font-bold">{flowStats.currentStreak}</p>
                  <p className="text-xs text-muted-foreground">Flow</p>
                </div>
              </div>
              <div className="mt-3 text-center">
                <p className="text-xs text-muted-foreground">Longest: Core {longestStreak} • Flow {flowStats.longestStreak}</p>
              </div>
            </CardContent>
          </Card>

          {/* Total Points */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-4 text-center">THE TOTAL</p>
              <div className="flex justify-center gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center mb-2">
                    <span className="text-xl font-bold text-cyan-500">{totalPoints}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">CORE</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-violet-600/20 flex items-center justify-center mb-2">
                    <span className="text-xl font-bold text-purple-500">{flowStats.totalFlows}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">FLOW</p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-2xl font-bold text-primary">{combinedTotalPoints}</p>
                <p className="text-xs text-muted-foreground">Combined Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Missions */}
        <StaffCore4MonthlyMissions />
      </div>
    </div>
  );
}
