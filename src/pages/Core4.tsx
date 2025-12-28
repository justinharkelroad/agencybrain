import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCore4Stats, Core4Domain } from '@/hooks/useCore4Stats';
import { useFlowStats } from '@/hooks/useFlowStats';
import { Core4MonthlyMissions } from '@/components/core4/Core4MonthlyMissions';
import { WeeklyHistoryCard } from '@/components/core4/WeeklyHistoryCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Dumbbell, Heart, Briefcase, Flame, ChevronLeft, ChevronRight, 
  Share2, Loader2, Zap
} from 'lucide-react';
import { LatinCross } from '@/components/icons/LatinCross';
import { format, addDays, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { SmartBackButton } from '@/components/SmartBackButton';

const domains: { key: Core4Domain; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'body', label: 'BODY', icon: Dumbbell, color: 'from-green-500 to-emerald-600' },
  { key: 'being', label: 'BEING', icon: LatinCross, color: 'from-purple-500 to-violet-600' },
  { key: 'balance', label: 'BALANCE', icon: Heart, color: 'from-pink-500 to-rose-600' },
  { key: 'business', label: 'BUSINESS', icon: Briefcase, color: 'from-blue-500 to-indigo-600' },
];

export default function Core4() {
  const {
    todayEntry,
    todayPoints,
    weeklyPoints,
    weeklyGoal,
    currentStreak,
    longestStreak,
    totalPoints,
    weeklyActivity,
    entries,
    loading,
    toggleDomain,
    isDateEditable,
    selectedDate,
    setSelectedDate,
    selectedWeekStart,
    navigateWeek,
    getEntryForDate,
  } = useCore4Stats();

  const flowStats = useFlowStats();
  const location = useLocation();

  // Scroll to hash anchor after content loads
  useEffect(() => {
    if (location.hash && !loading) {
      const elementId = location.hash.slice(1);
      setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [location.hash, loading]);

  const core4EntriesForHistory = useMemo(() => {
    return entries.map(entry => ({
      date: entry.date,
      points: (entry.body_completed ? 1 : 0) +
              (entry.being_completed ? 1 : 0) +
              (entry.balance_completed ? 1 : 0) +
              (entry.business_completed ? 1 : 0),
    }));
  }, [entries]);

  // Check if domain is completed for the selected date
  const isDomainCompleted = (domain: Core4Domain): boolean => {
    const entry = getEntryForDate(format(selectedDate, 'yyyy-MM-dd'));
    if (!entry) return false;
    return entry[`${domain}_completed`] as boolean;
  };

  // Get points for selected date
  const selectedDatePoints = useMemo(() => {
    const entry = getEntryForDate(format(selectedDate, 'yyyy-MM-dd'));
    if (!entry) return 0;
    return (entry.body_completed ? 1 : 0) +
           (entry.being_completed ? 1 : 0) +
           (entry.balance_completed ? 1 : 0) +
           (entry.business_completed ? 1 : 0);
  }, [selectedDate, getEntryForDate]);

  const handleToggle = async (domain: Core4Domain) => {
    await toggleDomain(domain, selectedDate);
  };

  const canEdit = isDateEditable(selectedDate);

  // Combined score: Core 4 weekly (max 28) + Flow weekly (max 7) = 35
  const combinedWeeklyScore = weeklyPoints + flowStats.weeklyProgress;
  const combinedWeeklyGoal = 35;
  const combinedPercentage = Math.round((combinedWeeklyScore / combinedWeeklyGoal) * 100);

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
              <h1 className="text-xl font-bold">Core 4</h1>
              <p className="text-sm text-muted-foreground">Daily habits tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-lg font-bold">{weeklyPoints} / {weeklyGoal}</p>
            </div>
            <Button variant="ghost" size="icon">
              <Share2 className="h-5 w-5" />
            </Button>
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
                  disabled={!canEdit}
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 p-8 rounded-xl transition-all duration-300",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50",
                    completed
                      ? `bg-gradient-to-br ${color} text-white shadow-xl scale-[1.02]`
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                    !canEdit && "opacity-50 cursor-not-allowed"
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
                {selectedDatePoints === 4 ? '🔥' : '🧘'}
              </div>
              <div>
                <p className="text-4xl font-bold">{selectedDatePoints}/4</p>
                <p className="text-muted-foreground">
                  {isToday(selectedDate) ? "Today's Score" : format(selectedDate, 'MMM d') + ' Score'}
                </p>
              </div>
              {currentStreak > 0 && isToday(selectedDate) && (
                <div className="flex items-center justify-center gap-2 text-orange-500">
                  <Flame className="h-6 w-6" />
                  <span className="text-xl font-bold">{currentStreak} day streak!</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Score Section - 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* The Score */}
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">THE SCORE</p>
              <div className="relative w-32 h-32 mx-auto mb-3">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${combinedPercentage * 2.83} 283`}
                    className="text-primary transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{combinedWeeklyScore}</span>
                  <span className="text-xs text-muted-foreground">/ {combinedWeeklyGoal}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Core 4: {weeklyPoints}/28</p>
                <p>Flow: {flowStats.weeklyProgress}/7</p>
              </div>
            </CardContent>
          </Card>

          {/* The Streaks */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-4 text-center">THE STREAKS</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Zap className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                  <p className="text-xl font-bold">{flowStats.currentStreak}</p>
                  <p className="text-xs text-muted-foreground">Flow</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                  <p className="text-xl font-bold">{currentStreak}</p>
                  <p className="text-xs text-muted-foreground">Core 4</p>
                </div>
              </div>
              <div className="mt-4 text-center text-xs text-muted-foreground">
                <p>Longest: Flow {flowStats.longestStreak} | Core {longestStreak}</p>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Monthly Missions */}
        <Core4MonthlyMissions />

        {/* Weekly History */}
        <WeeklyHistoryCard 
          core4Entries={core4EntriesForHistory}
          flowSessions={flowStats.sessions}
        />
      </div>
    </div>
  );
}
