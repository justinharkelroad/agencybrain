import { useEffect, useState } from "react";
import { supa } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";

const METRICS = [
  { key: "outbound_calls", label: "Outbound Calls" },
  { key: "talk_minutes", label: "Talk Minutes" },
  { key: "quoted_count", label: "Quoted Count" },
  { key: "sold_items", label: "Sold Items" },
  { key: "sold_policies", label: "Sold Policies" },
  { key: "sold_premium", label: "Sold Premium ($)" },
  { key: "cross_sells_uncovered", label: "Cross Sells Uncovered" },
  { key: "mini_reviews", label: "Mini Reviews" }
];

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export default function Targets() {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState<string>("");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const loadData = async () => {
    try {
      // Get user's agency
      const { data: profile } = await supa
        .from('profiles')
        .select('agency_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.agency_id) {
        toast.error('No agency found for user');
        return;
      }

      setAgencyId(profile.agency_id);

      // Load team members
      const { data: teamData } = await supa
        .from('team_members')
        .select('id, name, role')
        .eq('agency_id', profile.agency_id)
        .eq('status', 'active')
        .order('name');

      setTeam(teamData || []);

      // Load existing targets
      const { data: targetsData } = await supa
        .from('targets')
        .select('team_member_id, metric_key, value_number')
        .eq('agency_id', profile.agency_id);

      const targetsMap: Record<string, number> = {};
      if (targetsData) {
        for (const target of targetsData) {
          const scope = target.team_member_id || 'global';
          const key = `${scope}:${target.metric_key}`;
          targetsMap[key] = target.value_number;
        }
      }
      setTargets(targetsMap);

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const setTargetValue = (scope: string, metric: string, value: string) => {
    const key = `${scope}:${metric}`;
    setTargets(prev => ({
      ...prev,
      [key]: Number(value) || 0
    }));
  };

  const save = async () => {
    if (!agencyId) return;
    
    setSaving(true);
    try {
      // Prepare upsert data
      const upserts: any[] = [];
      for (const [key, value] of Object.entries(targets)) {
        const [scope, metric] = key.split(":");
        const memberId = scope === "global" ? null : scope;
        
        upserts.push({
          agency_id: agencyId,
          team_member_id: memberId,
          metric_key: metric,
          value_number: value
        });
      }

      if (upserts.length > 0) {
        const { error } = await supa
          .from("targets")
          .upsert(upserts, { 
            onConflict: "agency_id,team_member_id,metric_key",
            ignoreDuplicates: false 
          });

        if (error) throw error;
      }

      toast.success("Targets saved successfully!");
    } catch (error: any) {
      console.error('Error saving targets:', error);
      toast.error('Failed to save targets');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Performance Targets</CardTitle>
            <p className="text-muted-foreground">
              Set global defaults and individual targets for your team members. Individual targets override global defaults.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Team Member</TableHead>
                    {METRICS.map(metric => (
                      <TableHead key={metric.key} className="text-center min-w-32">
                        {metric.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Global Default</TableCell>
                    {METRICS.map(metric => (
                      <TableCell key={metric.key} className="text-center">
                        <Input
                          type="number"
                          min={0}
                          step={metric.key === 'sold_premium' ? 0.01 : 1}
                          value={targets[`global:${metric.key}`] || ''}
                          onChange={e => setTargetValue("global", metric.key, e.target.value)}
                          className="w-24 text-center"
                          placeholder="0"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  {team.map(member => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-muted-foreground">{member.role}</div>
                        </div>
                      </TableCell>
                      {METRICS.map(metric => (
                        <TableCell key={metric.key} className="text-center">
                          <Input
                            type="number"
                            min={0}
                            step={metric.key === 'sold_premium' ? 0.01 : 1}
                            value={targets[`${member.id}:${metric.key}`] || ''}
                            onChange={e => setTargetValue(member.id, metric.key, e.target.value)}
                            className="w-24 text-center"
                            placeholder={`${targets[`global:${metric.key}`] || 0}`}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save Targets"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}