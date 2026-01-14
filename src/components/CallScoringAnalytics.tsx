import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Users, Target, TrendingUp, BarChart3 } from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

interface CallData {
  id: string;
  team_member_id: string;
  team_member_name: string;
  potential_rank: string | null;
  overall_score: number | null;
  skill_scores: Array<{
    skill_name: string;
    score: number;
    max_score: number;
    feedback?: string;
    tip?: string;
  }> | null;
  discovery_wins: Array<{
    label: string;
    checked: boolean;
    evidence?: string | null;
  }> | null;
  analyzed_at: string | null;
}

interface TeamMember {
  id: string;
  name: string;
}

interface CallScoringAnalyticsProps {
  calls: CallData[];
  teamMembers: TeamMember[];
  checklistItemCount?: number;
}

const RANK_COLORS: Record<string, string> = {
  'VERY HIGH': '#22c55e',
  'HIGH': '#4ade80',
  'MEDIUM': '#facc15',
  'LOW': '#f97316',
  'VERY LOW': '#ef4444',
};

export function CallScoringAnalytics({ calls, teamMembers, checklistItemCount = 8 }: CallScoringAnalyticsProps) {
  const [selectedMember, setSelectedMember] = useState<string>('all');

  // Filter calls based on selected member
  const filteredCalls = useMemo(() => {
    const analyzedCalls = calls.filter(c => c.analyzed_at);
    if (selectedMember === 'all') return analyzedCalls;
    return analyzedCalls.filter(c => c.team_member_id === selectedMember);
  }, [calls, selectedMember]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = filteredCalls.length;
    if (total === 0) return null;

    // Rank distribution
    const rankCounts: Record<string, number> = {};
    filteredCalls.forEach(c => {
      if (c.potential_rank) {
        rankCounts[c.potential_rank] = (rankCounts[c.potential_rank] || 0) + 1;
      }
    });

    // Average skill scores
    const skillTotals = { rapport: 0, coverage: 0, closing: 0, objection_handling: 0, discovery: 0 };
    let skillCount = 0;
    filteredCalls.forEach(c => {
      if (Array.isArray(c.skill_scores) && c.skill_scores.length > 0) {
        c.skill_scores.forEach(skill => {
          // Scale score: if max_score is 10, multiply by 10 to get 0-100
          const scaledScore = skill.max_score === 10 ? skill.score * 10 : skill.score;
          const key = skill.skill_name.toLowerCase().replace(/[^a-z]/g, '');
          
          if (key.includes('rapport') || key.includes('opening') || key.includes('greeting')) {
            skillTotals.rapport += scaledScore;
          } else if (key.includes('discovery') || key.includes('question')) {
            skillTotals.discovery += scaledScore;
          } else if (key.includes('coverage') || key.includes('education') || key.includes('product')) {
            skillTotals.coverage += scaledScore;
          } else if (key.includes('closing') || key.includes('assumptive')) {
            skillTotals.closing += scaledScore;
          } else if (key.includes('objection')) {
            skillTotals.objection_handling += scaledScore;
          }
        });
        skillCount++;
      }
    });

    const avgSkills = skillCount > 0 ? {
      rapport: Math.round(skillTotals.rapport / skillCount),
      coverage: Math.round(skillTotals.coverage / skillCount),
      closing: Math.round(skillTotals.closing / skillCount),
      objection_handling: Math.round(skillTotals.objection_handling / skillCount),
      discovery: Math.round(skillTotals.discovery / skillCount),
    } : null;

    // Execution checklist hit rates
    const checklistTotals: Record<string, number> = {};
    let checklistCount = 0;
    filteredCalls.forEach(c => {
      if (Array.isArray(c.discovery_wins) && c.discovery_wins.length > 0) {
        c.discovery_wins.forEach(item => {
          // Use label directly - it's already human-readable
          checklistTotals[item.label] = (checklistTotals[item.label] || 0) + (item.checked ? 1 : 0);
        });
        checklistCount++;
      }
    });

    const checklistRates = checklistCount > 0 
      ? Object.entries(checklistTotals).map(([label, count]) => ({
          key: label,
          skill: label, // Label is already human-readable from DB
          rate: Math.round((count / checklistCount) * 100),
        })).sort((a, b) => b.rate - a.rate)
      : [];

    // Average checklist completion
    const avgChecklistCompletion = checklistCount > 0 
      ? Object.values(checklistTotals).reduce((a, b) => a + b, 0) / checklistCount
      : 0;

    // Per-member stats
    const memberStats = teamMembers.map(member => {
      const memberCalls = filteredCalls.filter(c => c.team_member_id === member.id);
      const memberTotal = memberCalls.length;
      if (memberTotal === 0) return null;

      let highRankCount = 0;
      let checklistSum = 0;
      let checklistCalls = 0;
      let scoreSum = 0;
      let scoreCalls = 0;

      memberCalls.forEach(c => {
        if (c.potential_rank === 'HIGH' || c.potential_rank === 'VERY HIGH') highRankCount++;
        if (c.overall_score) {
          scoreSum += c.overall_score;
          scoreCalls++;
        }
        if (Array.isArray(c.discovery_wins)) {
          const boolCount = c.discovery_wins.filter(item => item.checked).length;
          checklistSum += boolCount;
          checklistCalls++;
        }
      });

      return {
        id: member.id,
        name: member.name,
        totalCalls: memberTotal,
        avgScore: scoreCalls > 0 ? Math.round(scoreSum / scoreCalls) : 0,
        highRankPct: Math.round((highRankCount / memberTotal) * 100),
        avgChecklist: checklistCalls > 0 ? (checklistSum / checklistCalls).toFixed(1) : '0',
      };
    }).filter(Boolean);

    return {
      total,
      rankCounts,
      avgSkills,
      checklistRates,
      avgChecklistCompletion: avgChecklistCompletion.toFixed(1),
      memberStats,
    };
  }, [filteredCalls, teamMembers]);

  // Prepare chart data
  const rankPieData = useMemo(() => {
    if (!stats?.rankCounts) return [];
    return Object.entries(stats.rankCounts).map(([rank, count]) => ({
      name: rank,
      value: count,
      color: RANK_COLORS[rank] || '#888',
    }));
  }, [stats]);

  const radarData = useMemo(() => {
    if (!stats?.avgSkills) return [];
    return [
      { skill: 'Rapport', value: stats.avgSkills.rapport, fullMark: 100 },
      { skill: 'Discovery', value: stats.avgSkills.discovery, fullMark: 100 },
      { skill: 'Coverage', value: stats.avgSkills.coverage, fullMark: 100 },
      { skill: 'Objection', value: stats.avgSkills.objection_handling, fullMark: 100 },
      { skill: 'Closing', value: stats.avgSkills.closing, fullMark: 100 },
    ];
  }, [stats]);

  if (calls.filter(c => c.analyzed_at).length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No analyzed calls yet</p>
          <p className="text-sm">Upload and analyze calls to see team analytics</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Analytics Dashboard
        </h2>
        <Select value={selectedMember} onValueChange={setSelectedMember}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by team member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Team Members</SelectItem>
            {teamMembers.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-sm text-muted-foreground">Calls Analyzed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.rankCounts ? 
                    Math.round(((stats.rankCounts['HIGH'] || 0) + (stats.rankCounts['VERY HIGH'] || 0)) / stats.total * 100) 
                    : 0}%
                </p>
                <p className="text-sm text-muted-foreground">High/Very High Rank</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.avgChecklistCompletion || 0} / {checklistItemCount}</p>
                <p className="text-sm text-muted-foreground">Avg Checklist Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rank Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Potential Rank Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {rankPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={rankPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {rankPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} calls`, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                No rank data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skill Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team Skill Execution Gap</CardTitle>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis 
                    dataKey="skill" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <Radar
                    name="Target"
                    dataKey="fullMark"
                    stroke="hsl(var(--primary))"
                    fill="none"
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                  />
                  <Radar
                    name="Team Avg"
                    dataKey="value"
                    stroke="hsl(var(--destructive))"
                    fill="hsl(var(--destructive))"
                    fillOpacity={0.3}
                  />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                No skill data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Execution Checklist Hit Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Execution Checklist Hit Rates</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.checklistRates && stats.checklistRates.length > 0 ? (
            <div className="space-y-4">
              {stats.checklistRates.map((item: any) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.skill}</span>
                    <span className={`font-medium ${
                      item.rate >= 70 ? 'text-green-400' : 
                      item.rate >= 40 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {item.rate}%
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        item.rate >= 70 ? 'bg-green-500' : 
                        item.rate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${item.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              No checklist data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Member Comparison - Only show in "All" view */}
      {selectedMember === 'all' && stats?.memberStats && stats.memberStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Member Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Team Member</th>
                    <th className="text-center py-2 px-3 font-medium">Calls</th>
                    <th className="text-center py-2 px-3 font-medium">Avg Score</th>
                    <th className="text-center py-2 px-3 font-medium">High Rank %</th>
                    <th className="text-center py-2 px-3 font-medium">Avg Checklist</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.memberStats.map((member: any) => (
                    <tr key={member.id} className="border-b hover:bg-accent/50">
                      <td className="py-2 px-3 font-medium">{member.name}</td>
                      <td className="py-2 px-3 text-center">{member.totalCalls}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant={member.avgScore >= 70 ? 'default' : 'secondary'}>
                          {member.avgScore}%
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={member.highRankPct >= 50 ? 'text-green-500' : 'text-muted-foreground'}>
                          {member.highRankPct}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">{member.avgChecklist}/{checklistItemCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Recent Calls - when filtered to a specific member */}
      {selectedMember !== 'all' && filteredCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredCalls.slice(0, 5).map(call => (
                <div key={call.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">
                      {call.analyzed_at ? new Date(call.analyzed_at).toLocaleDateString() : 'Pending'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Score: {call.overall_score || 'N/A'}
                    </p>
                  </div>
                  <Badge className={
                    call.potential_rank === 'VERY HIGH' || call.potential_rank === 'HIGH'
                      ? 'bg-green-500/20 text-green-400'
                      : call.potential_rank === 'MEDIUM'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                  }>
                    {call.potential_rank || 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
