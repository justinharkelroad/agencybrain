import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomFieldsManager } from "@/components/CustomFieldsManager";
import { EnhancedKPIConfigDialog } from "@/components/dialogs/EnhancedKPIConfigDialog";
import { DailyAgencyGoalsConfig } from "@/components/settings/DailyAgencyGoalsConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Target, Database } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export const SettingsContent = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [agencyId, setAgencyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableMetrics, setAvailableMetrics] = useState<Array<{key: string, label: string}>>([]);
  
  const initialTab = searchParams.get('tab') || 'scorecards';
  const initialRole = (searchParams.get('role') as "Sales" | "Service") || "Sales";
  
  const [selectedRole, setSelectedRole] = useState<"Sales" | "Service">(initialRole);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [nRequired, setNRequired] = useState<number>(2);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [countedDays, setCountedDays] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false
  });
  const [backfillDays, setBackfillDays] = useState(7);
  const [countWeekendIfSubmitted, setCountWeekendIfSubmitted] = useState(true);
  const [ringMetrics, setRingMetrics] = useState<string[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id, selectedRole]);

  const loadData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')  
        .eq('id', user.id)
        .single();

      if (!profile?.agency_id) {
        setLoading(false);
        return;
      }

      setAgencyId(profile.agency_id);

      const { data: kpis, error: kpisError } = await supabase
        .from('kpis')
        .select('key, label')
        .eq('agency_id', profile.agency_id)
        .eq('is_active', true)
        .order('key');

      if (kpisError) throw kpisError;

      const metrics = (kpis || []).map(kpi => ({
        key: kpi.key,
        label: kpi.label
      }));

      setAvailableMetrics(metrics);

      const { data: rules } = await supabase
        .from("scorecard_rules")
        .select("*")
        .eq("agency_id", profile.agency_id)
        .eq("role", selectedRole)
        .single();

      if (rules) {
        setSelectedMetrics(rules.selected_metrics || []);
        setNRequired(rules.n_required || 2);
        setWeights((rules.weights as Record<string, number>) || {});
        setCountedDays((rules.counted_days as any) || {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false
        });
        setBackfillDays(rules.backfill_days || 7);
        setCountWeekendIfSubmitted(rules.count_weekend_if_submitted ?? true);
        setRingMetrics(rules.ring_metrics || []);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast("Failed to load settings", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMetric = (metricKey: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metricKey) 
        ? prev.filter(x => x !== metricKey)
        : [...prev, metricKey]
    );
  };

  const setWeight = (metricKey: string, value: string) => {
    setWeights(prev => ({
      ...prev,
      [metricKey]: Number(value) || 0
    }));
  };

  const toggleDay = (day: string) => {
    setCountedDays(prev => ({
      ...prev,
      [day]: !prev[day as keyof typeof prev]
    }));
  };

  const toggleRingMetric = (metricKey: string) => {
    setRingMetrics(prev => 
      prev.includes(metricKey) 
        ? prev.filter(x => x !== metricKey)
        : [...prev, metricKey]
    );
  };

  const saveScorecardSettings = async () => {
    if (!agencyId) return;
    
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    if (totalWeight !== 100) {
      toast("Invalid weights", {
        description: "Weights must total exactly 100"
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("scorecard_rules")
        .upsert({
          agency_id: agencyId,
          role: selectedRole,
          selected_metrics: selectedMetrics,
          n_required: nRequired,
          weights,
          counted_days: countedDays,
          backfill_days: backfillDays,
          count_weekend_if_submitted: countWeekendIfSubmitted,
          ring_metrics: ringMetrics
        }, { 
          onConflict: "agency_id,role" 
        });

      if (error) throw error;

      toast("Settings saved", {
        description: "Scorecard settings saved successfully!"
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast("Failed to save settings", {
        description: error.message
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse py-8">Loading settings...</div>
    );
  }

  return (
    <Tabs defaultValue={initialTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="scorecards" className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          Scorecards
        </TabsTrigger>
        <TabsTrigger value="prospects" className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Prospect Fields
        </TabsTrigger>
        <TabsTrigger value="targets" className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          Targets
        </TabsTrigger>
        <TabsTrigger value="team" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Team Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="scorecards" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Scorecard Configuration - {selectedRole}</CardTitle>
            <CardDescription>
              Configure metrics, weights, and performance tracking for {selectedRole} team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {availableMetrics.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading available metrics...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Role Configuration</Label>
                  <Select value={selectedRole} onValueChange={(value: "Sales" | "Service") => setSelectedRole(value)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-base font-medium">Selected Metrics</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Choose which metrics count towards daily performance.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {availableMetrics.map(metric => (
                      <div key={metric.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={metric.key}
                          checked={selectedMetrics.includes(metric.key)}
                          onCheckedChange={() => toggleMetric(metric.key)}
                        />
                        <Label htmlFor={metric.key}>{metric.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="n-required" className="text-base font-medium">Targets Required to Pass</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    How many metrics must hit targets to pass for the day?
                  </p>
                  <Select value={nRequired.toString()} onValueChange={(value) => setNRequired(Number(value))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: Math.max(1, selectedMetrics.length) }, (_, i) => i + 1).map(num => (
                        <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-base font-medium">Score Weights (must total 100)</Label>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    {availableMetrics.map(metric => (
                      <div key={metric.key} className="flex items-center justify-between">
                        <Label htmlFor={`weight-${metric.key}`} className="flex-1">
                          {metric.label}
                        </Label>
                        <Input
                          id={`weight-${metric.key}`}
                          type="number"
                          min={0}
                          max={100}
                          value={weights[metric.key] || 0}
                          onChange={e => setWeight(metric.key, e.target.value)}
                          className="w-20 text-center"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-sm">
                    <span className={`font-medium ${Object.values(weights).reduce((a, b) => a + b, 0) === 100 ? 'text-green-600' : 'text-red-600'}`}>
                      Total: {Object.values(weights).reduce((a, b) => a + b, 0)}%
                    </span>
                  </div>
                </div>

                <div>
                  <Label className="text-base font-medium">Counted Days</Label>
                  <div className="grid grid-cols-7 gap-2 mt-3">
                    {Object.entries(countedDays).map(([day, checked]) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={day}
                          checked={checked}
                          onCheckedChange={() => toggleDay(day)}
                        />
                        <Label htmlFor={day} className="text-sm capitalize">{day.slice(0, 3)}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-base font-medium">Show in Performance Rings</Label>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {availableMetrics.map(metric => (
                      <div key={`ring-${metric.key}`} className="flex items-center space-x-2">
                        <Checkbox
                          id={`ring-${metric.key}`}
                          checked={ringMetrics.includes(metric.key)}
                          onCheckedChange={() => toggleRingMetric(metric.key)}
                        />
                        <Label htmlFor={`ring-${metric.key}`}>{metric.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="backfill-days" className="text-base font-medium">Backfill Window (Days)</Label>
                  <Input
                    id="backfill-days" 
                    type="number"
                    min={1}
                    max={30}
                    value={backfillDays}
                    onChange={e => setBackfillDays(Number(e.target.value) || 7)}
                    className="w-20 mt-2"
                  />
                </div>

                <div>
                  <Label className="text-base font-medium">KPI Targets</Label>
                  <div className="flex gap-2 mt-3">
                    <EnhancedKPIConfigDialog 
                      title={`${selectedRole} KPI Configuration`}
                      type={selectedRole === "Sales" ? "sales" : "service"}
                      agencyId={agencyId}
                    >
                      <Button variant="flat">Configure KPIs</Button>
                    </EnhancedKPIConfigDialog>
                    <Link to="/targets">
                      <Button variant="flat">Manage KPI Targets</Button>
                    </Link>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveScorecardSettings} disabled={saving} variant="flat">
                    {saving ? "Saving..." : "Save Scorecard Settings"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="prospects" className="space-y-6">
        {agencyId && <CustomFieldsManager agencyId={agencyId} />}
      </TabsContent>

      <TabsContent value="targets" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>KPI Targets Management</CardTitle>
            <CardDescription>Configure daily target values for your metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/targets">
              <Button variant="flat">Open Targets Manager</Button>
            </Link>
          </CardContent>
        </Card>
        
        <DailyAgencyGoalsConfig agencyId={agencyId} />
      </TabsContent>

      <TabsContent value="team" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Team Settings</CardTitle>
            <CardDescription>Manage team-wide configurations</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Team settings will be available soon.</p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
