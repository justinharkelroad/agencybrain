import { useState, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomFieldsManager } from "@/components/CustomFieldsManager";
import { EnhancedKPIConfigDialog } from "@/components/dialogs/EnhancedKPIConfigDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Users, Target, Database } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";


export default function Settings() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [agencyId, setAgencyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableMetrics, setAvailableMetrics] = useState<Array<{key: string, label: string}>>([]);
  
  // Get initial tab and role from URL params
  const initialTab = searchParams.get('tab') || 'scorecards';
  const initialRole = (searchParams.get('role') as "Sales" | "Service") || "Sales";
  
  // Scorecard Settings
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
      // Get user's agency
      const { data: profile } = await supa
        .from('profiles')
        .select('agency_id')  
        .eq('id', user.id)
        .single();

      if (!profile?.agency_id) {
        setLoading(false);
        return;
      }

      setAgencyId(profile.agency_id);

      // Load available KPIs for this agency
      const { data: kpis, error: kpisError } = await supa
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

      // Load scorecard rules for this agency and role
      const { data: rules } = await supa
        .from("scorecard_rules")
        .select("*")
        .eq("agency_id", profile.agency_id)
        .eq("role", selectedRole)
        .single();

      if (rules) {
        setSelectedMetrics(rules.selected_metrics || []);
        setNRequired(rules.n_required || 2);
        setWeights((rules.weights as Record<string, number>) || {});
        setCountedDays((rules.counted_days as {
          monday: boolean;
          tuesday: boolean;
          wednesday: boolean;
          thursday: boolean;
          friday: boolean;
          saturday: boolean;
          sunday: boolean;
        }) || {
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
      const { error } = await supa
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

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-muted-foreground">Please log in to access settings.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <SettingsIcon className="h-8 w-8" />
            Settings
          </h1>
          <p className="text-muted-foreground">
            Configure scorecards, custom fields, and system preferences
          </p>
        </div>

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
                    {/* Role Selection */}
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

                    {/* Metric Selection */}
                    <div>
                      <Label className="text-base font-medium">Selected Metrics</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Choose which metrics count towards daily performance. Passing requires hitting targets on N of these selected metrics.
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

                    {/* N Required */}
                    <div>
                      <Label htmlFor="n-required" className="text-base font-medium">Targets Required to Pass</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        How many of the selected metrics must hit their targets to be considered "passing" for the day?
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

                    {/* Weights */}
                    <div>
                      <Label className="text-base font-medium">Score Weights (must total 100)</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Weight is added to daily score only when actual performance exceeds the target (not just meets it).
                      </p>
                      <div className="grid grid-cols-2 gap-4">
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
                        {Object.values(weights).reduce((a, b) => a + b, 0) !== 100 && <span className="text-muted-foreground ml-2">(must equal 100)</span>}
                      </div>
                    </div>

                    {/* Counted Days */}
                    <div>
                      <Label className="text-base font-medium">Counted Days</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Which days of the week count towards streaks and performance tracking?
                      </p>
                      <div className="grid grid-cols-7 gap-2">
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
                      <div className="mt-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="count-weekend-submit"
                            checked={countWeekendIfSubmitted}
                            onCheckedChange={(checked) => setCountWeekendIfSubmitted(checked === true)}
                          />
                          <Label htmlFor="count-weekend-submit" className="text-sm">
                            Count weekend days if submission exists (overrides day settings above)
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Ring Metrics */}
                    <div>
                      <Label className="text-base font-medium">Show in Performance Rings</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Select which metrics to display in the visual performance rings dashboard.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
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

                    {/* Backfill Days */}
                    <div>
                      <Label htmlFor="backfill-days" className="text-base font-medium">Backfill Window (Days)</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        When recalculating metrics, how many days back should be processed?
                      </p>
                      <Input
                        id="backfill-days" 
                        type="number"
                        min={1}
                        max={30}
                        value={backfillDays}
                        onChange={e => setBackfillDays(Number(e.target.value) || 7)}
                        className="w-20"
                      />
                    </div>

                    {/* KPI Targets Management */}
                    <div>
                      <Label className="text-base font-medium">KPI Targets</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Configure the daily target values for each metric. These targets determine when team members are considered to be hitting their goals.
                      </p>
                      <div className="flex gap-2">
                        <EnhancedKPIConfigDialog
                          title={`Configure ${selectedRole} KPI Targets`}
                          type={selectedRole.toLowerCase() as "sales" | "service"}
                          agencyId={agencyId}
                        >
                          <Button variant="outline">
                            <SettingsIcon className="h-4 w-4 mr-2" />
                            Edit {selectedRole} Targets
                          </Button>
                        </EnhancedKPIConfigDialog>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-4">
                      <Button onClick={saveScorecardSettings} disabled={saving || Object.values(weights).reduce((a, b) => a + b, 0) !== 100}>
                        {saving ? "Saving..." : "Save Scorecard Settings"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prospects" className="space-y-6">
            <CustomFieldsManager agencyId={agencyId} />
          </TabsContent>

          <TabsContent value="targets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Targets</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Set individual targets for team members and roles. Team performance can be viewed from the Metrics Dashboard.
                </p>
              </CardHeader>
              <CardContent>
                <Link to="/targets">
                  <Button variant="outline">
                    <Target className="h-4 w-4 mr-2" />
                    Manage KPI Targets
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Management</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure team settings and permissions.
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Team management features coming soon.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}