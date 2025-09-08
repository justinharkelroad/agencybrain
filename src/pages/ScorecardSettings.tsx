import { useEffect, useState } from "react";
import { supa } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { EnhancedKPIConfigDialog } from "@/components/dialogs/EnhancedKPIConfigDialog";
import { Settings } from "lucide-react";

interface KPIOption {
  key: string;
  label: string;
}

interface ScorecardSettingsProps {
  role: "Sales" | "Service";
}

export default function ScorecardSettings({ role = "Sales" }: ScorecardSettingsProps) {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableMetrics, setAvailableMetrics] = useState<KPIOption[]>([]);
  
  const [selectedRole, setSelectedRole] = useState<"Sales" | "Service">(role);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "outbound_calls", "talk_minutes", "quoted_count", "sold_items"
  ]);
  const [nRequired, setNRequired] = useState<number>(2);
  const [weights, setWeights] = useState<Record<string, number>>({
    outbound_calls: 10,
    talk_minutes: 20,
    quoted_count: 30,
    sold_items: 40
  });
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
  const [ringMetrics, setRingMetrics] = useState<string[]>([
    "outbound_calls", "talk_minutes", "quoted_count", "sold_items"
  ]);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id, selectedRole]);

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

      // Load available KPIs for this agency
      const { data: kpis, error: kpisError } = await supa
        .from('kpis')
        .select('key, label')
        .eq('agency_id', profile.agency_id)
        .eq('is_active', true)
        .order('key');

      if (kpisError) throw kpisError;

      const metrics: KPIOption[] = (kpis || []).map(kpi => ({
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
        setSelectedMetrics(rules.selected_metrics || selectedMetrics);
        setNRequired(rules.n_required || 2);
        setWeights(typeof rules.weights === 'object' && rules.weights ? rules.weights as Record<string, number> : weights);
        setCountedDays(typeof rules.counted_days === 'object' && rules.counted_days ? rules.counted_days as { monday: boolean; tuesday: boolean; wednesday: boolean; thursday: boolean; friday: boolean; saturday: boolean; sunday: boolean; } : countedDays);
        setBackfillDays(rules.backfill_days || 7);
        setCountWeekendIfSubmitted(rules.count_weekend_if_submitted ?? true);
        setRingMetrics(rules.ring_metrics || rules.selected_metrics || ringMetrics);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Failed to load scorecard settings');
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

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const maxRequired = Math.max(1, selectedMetrics.length);

  const save = async () => {
    if (!agencyId) return;
    
    if (totalWeight !== 100) {
      toast.error("Weights must total exactly 100");
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

      toast.success("Scorecard settings saved successfully!");
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save scorecard settings');
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Scorecard Settings</CardTitle>
            <div className="flex items-center gap-4">
              <Label htmlFor="role-select">Role:</Label>
              <Select value={selectedRole} onValueChange={(value: "Sales" | "Service") => setSelectedRole(value)}>
                <SelectTrigger id="role-select" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            
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
                  {Array.from({ length: maxRequired }, (_, i) => i + 1).map(num => (
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
                <span className={`font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                  Total: {totalWeight}%
                </span>
                {totalWeight !== 100 && <span className="text-muted-foreground ml-2">(must equal 100)</span>}
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
                    <Settings className="h-4 w-4 mr-2" />
                    Edit {selectedRole} Targets
                  </Button>
                </EnhancedKPIConfigDialog>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button onClick={save} disabled={saving || totalWeight !== 100}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}