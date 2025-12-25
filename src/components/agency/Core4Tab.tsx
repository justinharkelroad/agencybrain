import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, Flame, Heart, Scale, Briefcase, CheckCircle2, Circle, Loader2, Calendar, Zap } from 'lucide-react';
import { LatinCross } from '@/components/icons/LatinCross';
import { useTeamCore4Stats } from '@/hooks/useTeamCore4Stats';
import { format, startOfWeek, addDays } from 'date-fns';

const DOMAIN_CONFIG = {
  body: { label: 'Body', icon: Heart, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  being: { label: 'Being', icon: LatinCross, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  balance: { label: 'Balance', icon: Scale, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  business: { label: 'Business', icon: Briefcase, color: 'text-green-500', bgColor: 'bg-green-500/10' },
} as const;

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Core4Tab() {
  const { members, teamTotal, teamGoal, loading, error } = useTeamCore4Stats();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load Core 4 data. Please try again.
        </CardContent>
      </Card>
    );
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">No Core 4 Data Yet</h3>
          <p className="text-muted-foreground">
            Team members will appear here once they start tracking their Core 4 habits.
          </p>
        </CardContent>
      </Card>
    );
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDates = DAYS_OF_WEEK.map((_, i) => addDays(weekStart, i));

  const selectedMember = members.find(m => m.staffUserId === selectedMemberId);
  const progressPercent = teamGoal > 0 ? (teamTotal / teamGoal) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Team Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Team Core 4 + Flow Summary
          </CardTitle>
          <CardDescription>
            Weekly progress for all team members (35 pts max each)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Team Weekly Points</span>
              <span className="font-medium">{teamTotal} / {teamGoal}</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {members.length} team member{members.length !== 1 ? 's' : ''} tracking • 
              Max {teamGoal} points (Core 4: 28 + Flow: 7 per member)
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="weekly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="weekly" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Weekly Progress
          </TabsTrigger>
          <TabsTrigger value="missions" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Monthly Missions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Team Member</TableHead>
                      <TableHead className="text-center">Today</TableHead>
                      {DAYS_OF_WEEK.map((day, i) => (
                        <TableHead key={day} className="text-center text-xs">
                          {day}
                          <div className="text-[10px] text-muted-foreground">
                            {format(weekDates[i], 'M/d')}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center">
                          <span>Flow</span>
                          <Zap className="h-3 w-3 text-cyan-500" />
                        </div>
                      </TableHead>
                      <TableHead className="text-center">Week Total</TableHead>
                      <TableHead className="text-center">Streak</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members
                      .sort((a, b) => b.combinedWeeklyPoints - a.combinedWeeklyPoints)
                      .map(member => {
                        const todayScore = member.todayEntry 
                          ? [
                              member.todayEntry.body_completed,
                              member.todayEntry.being_completed,
                              member.todayEntry.balance_completed,
                              member.todayEntry.business_completed,
                            ].filter(Boolean).length
                          : 0;

                        return (
                          <TableRow 
                            key={member.staffUserId}
                            className={`cursor-pointer hover:bg-muted/50 ${selectedMemberId === member.staffUserId ? 'bg-muted' : ''}`}
                            onClick={() => setSelectedMemberId(
                              selectedMemberId === member.staffUserId ? null : member.staffUserId
                            )}
                          >
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span className="truncate max-w-[160px]">{member.name}</span>
                                <div className="flex items-center gap-1 mt-1">
                                  {Object.entries(DOMAIN_CONFIG).map(([domain, config]) => {
                                    const Icon = config.icon;
                                    const completed = member.todayEntry?.[`${domain}_completed` as keyof typeof member.todayEntry];
                                    return (
                                      <Icon 
                                        key={domain}
                                        className={`h-3 w-3 ${completed ? config.color : 'text-muted-foreground/30'}`}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={todayScore === 4 ? 'default' : todayScore > 0 ? 'secondary' : 'outline'}
                                className="min-w-[40px]"
                              >
                                {todayScore}/4
                              </Badge>
                            </TableCell>
                            {weekDates.map((date, i) => {
                              const dateStr = format(date, 'yyyy-MM-dd');
                              const entry = member.entries.find(e => e.date === dateStr);
                              const dayScore = entry 
                                ? [entry.body_completed, entry.being_completed, entry.balance_completed, entry.business_completed].filter(Boolean).length
                                : 0;
                              
                              return (
                                <TableCell key={i} className="text-center">
                                  {dayScore === 4 ? (
                                    <CheckCircle2 className="h-5 w-5 mx-auto text-green-500" />
                                  ) : dayScore > 0 ? (
                                    <div className="flex items-center justify-center">
                                      <span className="text-xs font-medium text-muted-foreground">
                                        {dayScore}
                                      </span>
                                    </div>
                                  ) : (
                                    <Circle className="h-4 w-4 mx-auto text-muted-foreground/30" />
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center">
                              <Badge 
                                variant={member.flowWeeklyProgress > 0 ? 'default' : 'outline'}
                                className={`min-w-[40px] ${member.flowWeeklyProgress > 0 ? 'bg-cyan-500 hover:bg-cyan-600' : ''}`}
                              >
                                {member.flowWeeklyProgress}/7
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span className="font-bold">{member.combinedWeeklyPoints}</span>
                                <Progress 
                                  value={(member.combinedWeeklyPoints / 35) * 100} 
                                  className="h-1.5 w-12 mt-1"
                                />
                                <span className="text-[10px] text-muted-foreground">/ 35</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                {member.streak > 0 && (
                                  <div className="flex items-center gap-0.5">
                                    <Flame className="h-4 w-4 text-orange-500" />
                                    <span className="font-medium text-orange-600">{member.streak}</span>
                                  </div>
                                )}
                                {member.flowStreak > 0 && (
                                  <div className="flex items-center gap-0.5">
                                    <Zap className="h-4 w-4 text-cyan-500" />
                                    <span className="font-medium text-cyan-600">{member.flowStreak}</span>
                                  </div>
                                )}
                                {member.streak === 0 && member.flowStreak === 0 && (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="missions" className="space-y-4">
          {selectedMember ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{selectedMember.name}'s Monthly Missions</CardTitle>
                <CardDescription>
                  {format(new Date(), 'MMMM yyyy')} - Click a row in Weekly Progress to select a team member
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedMember.missions.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedMember.missions.map(mission => {
                      const config = DOMAIN_CONFIG[mission.domain as keyof typeof DOMAIN_CONFIG];
                      const Icon = config.icon;
                      const completedCount = mission.items.filter(item => item.completed).length;
                      
                      return (
                        <Card key={mission.id} className={`${config.bgColor} border-0`}>
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Icon className={`h-5 w-5 ${config.color}`} />
                              <span className={config.color}>{config.label}</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="font-medium">{mission.title}</p>
                            {mission.items.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">
                                  Progress: {completedCount}/{mission.items.length}
                                </div>
                                <Progress 
                                  value={mission.items.length > 0 ? (completedCount / mission.items.length) * 100 : 0}
                                  className="h-2"
                                />
                              </div>
                            )}
                            {mission.weekly_measurable && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">Weekly Goal:</span> {mission.weekly_measurable}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No monthly missions set for this team member.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a team member from the Weekly Progress tab to view their monthly missions.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
