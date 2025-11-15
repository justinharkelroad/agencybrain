import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Sparkles, Calendar, Zap, CheckCircle2 } from "lucide-react";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { useQuarterlyTargets } from "@/hooks/useQuarterlyTargets";

export default function LifeTargets() {
  const navigate = useNavigate();
  const { currentQuarter } = useLifeTargetsStore();
  const { data: targets, isLoading } = useQuarterlyTargets(currentQuarter);

  // Memoize computed values for performance
  const targetsSet = useMemo(() => 
    targets ? [
      targets.body_target,
      targets.being_target,
      targets.balance_target,
      targets.business_target,
    ].filter(Boolean).length : 0,
    [targets]
  );

  const hasMissions = useMemo(() => 
    targets ? [
      targets.body_monthly_missions,
      targets.being_monthly_missions,
      targets.balance_monthly_missions,
      targets.business_monthly_missions,
    ].some(m => m && Object.keys(m).length > 0) : false,
    [targets]
  );

  const hasHabits = useMemo(() => 
    targets ? [
      targets.body_daily_habit,
      targets.being_daily_habit,
      targets.balance_daily_habit,
      targets.business_daily_habit,
    ].filter(Boolean).length : 0,
    [targets]
  );

  const actions = [
    {
      title: 'Set Quarterly Targets',
      description: 'Define your goals for Body, Being, Balance, and Business',
      icon: Target,
      onClick: () => navigate('/life-targets/quarterly'),
      variant: 'default' as const,
      badge: targetsSet > 0 ? `${targetsSet}/4 set` : undefined,
    },
    {
      title: 'Analyze Measurability',
      description: 'Get clarity scores and improvement suggestions',
      icon: Sparkles,
      onClick: () => navigate('/life-targets/quarterly'),
      variant: 'outline' as const,
      disabled: targetsSet === 0,
    },
    {
      title: 'Generate Monthly Missions',
      description: 'Break down targets into 3-month action plans',
      icon: Calendar,
      onClick: () => navigate('/life-targets/missions'),
      variant: 'outline' as const,
      disabled: targetsSet === 0,
      badge: hasMissions ? 'Generated' : undefined,
    },
    {
      title: 'Get Daily Actions',
      description: 'Discover 10 actionable habits per domain',
      icon: Zap,
      onClick: () => navigate('/life-targets/daily'),
      variant: 'outline' as const,
      disabled: targetsSet === 0,
      badge: hasHabits > 0 ? `${hasHabits} habits set` : undefined,
    },
  ];

  return (
    <div className="container max-w-4xl py-8 space-y-8 animate-fade-in">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Life Targets</h1>
          <Badge variant="outline" className="text-lg px-3 py-1">
            {currentQuarter}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Plan and track your quarterly life goals across four key domains
        </p>
      </div>

      {!isLoading && targets && (
        <Card>
          <CardHeader>
            <CardTitle>Current Quarter Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  targetsSet > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">{targetsSet} of 4 Targets</p>
                  <p className="text-sm text-muted-foreground">Quarterly goals set</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  hasMissions ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">{hasMissions ? 'Missions Generated' : 'No Missions Yet'}</p>
                  <p className="text-sm text-muted-foreground">Monthly action plans</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  hasHabits > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">{hasHabits} Daily Habits</p>
                  <p className="text-sm text-muted-foreground">Active daily actions</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  targetsSet === 4 && hasMissions && hasHabits === 4 
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">
                    {targetsSet === 4 && hasMissions && hasHabits === 4 ? 'Complete Setup' : 'Setup Incomplete'}
                  </p>
                  <p className="text-sm text-muted-foreground">Quarter planning status</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Card 
              key={action.title} 
              className="hover:shadow-lg transition-all duration-300 hover-scale animate-scale-in"
              style={{ animationDelay: `${index * 0.1}s` }}
              role="article"
              aria-label={action.title}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors ${
                    action.disabled ? 'bg-muted' : 'bg-primary/10'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      action.disabled ? 'text-muted-foreground' : 'text-primary'
                    }`} aria-hidden="true" />
                  </div>
                  {action.badge && (
                    <Badge variant="secondary" className="animate-fade-in">{action.badge}</Badge>
                  )}
                </div>
                <CardTitle className="text-lg">{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={action.onClick}
                  variant={action.variant}
                  disabled={action.disabled}
                  className="w-full"
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
