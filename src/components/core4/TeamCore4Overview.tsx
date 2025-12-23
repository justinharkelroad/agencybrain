import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Flame, Heart, Brain, Scale, Briefcase, ArrowRight, Loader2 } from 'lucide-react';
import { useTeamCore4Stats } from '@/hooks/useTeamCore4Stats';

const DOMAIN_ICONS = {
  body: Heart,
  being: Brain,
  balance: Scale,
  business: Briefcase,
};

const DOMAIN_COLORS = {
  body: 'text-red-500',
  being: 'text-purple-500',
  balance: 'text-blue-500',
  business: 'text-green-500',
};

export function TeamCore4Overview() {
  const { members, teamTotal, teamGoal, loading, error } = useTeamCore4Stats();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Team Core 4 Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || members.length === 0) {
    return null; // Don't show the card if no team members
  }

  // Sort by weekly points descending
  const topPerformers = [...members]
    .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
    .slice(0, 5);

  const progressPercent = teamGoal > 0 ? (teamTotal / teamGoal) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              Team Core 4 Progress
            </CardTitle>
            <CardDescription className="mt-1">
              Weekly team performance across all domains
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/agency?tab=core4" className="flex items-center gap-1">
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Team Weekly Points</span>
            <span className="font-medium">{teamTotal} / {teamGoal}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Top Performers */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Top Performers</h4>
          <div className="space-y-2">
            {topPerformers.map((member, index) => (
              <div 
                key={member.userId}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-4">
                    {index + 1}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium truncate max-w-[120px]">
                      {member.name}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {(['body', 'being', 'balance', 'business'] as const).map(domain => {
                        const Icon = DOMAIN_ICONS[domain];
                        const completed = member.todayEntry?.[`${domain}_completed`];
                        return (
                          <Icon 
                            key={domain}
                            className={`h-3 w-3 ${completed ? DOMAIN_COLORS[domain] : 'text-muted-foreground/30'}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.streak > 0 && (
                    <div className="flex items-center gap-0.5">
                      <Flame className="h-3.5 w-3.5 text-orange-500" />
                      <span className="text-xs font-medium text-orange-600">{member.streak}</span>
                    </div>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {member.weeklyPoints} pts
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
