import { useState, useEffect } from "react";
import { supa } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { TopNav } from "@/components/TopNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomFieldsManager } from "@/components/CustomFieldsManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Users, Target, Database } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const ALL_METRICS = [
  { key: "outbound_calls", label: "Outbound Calls" },
  { key: "talk_minutes", label: "Talk Minutes" },
  { key: "quoted_count", label: "Quoted Count" },
  { key: "sold_items", label: "Sold Items" },
  { key: "sold_policies", label: "Sold Policies" },
  { key: "sold_premium", label: "Sold Premium" },
  { key: "cross_sells_uncovered", label: "Cross Sells Uncovered" },
  { key: "mini_reviews", label: "Mini Reviews" }
];

export default function Settings() {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Scorecard Settings
  const [selectedRole, setSelectedRole] = useState<"Sales" | "Service">("Sales");
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
        setCountWeekendIfSubmitted(rules.count_weekend_if_submitted ?? true);
        setRingMetrics(rules.ring_metrics || rules.selected_metrics || ringMetrics);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Failed to load settings');
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

  const saveScorecardSettings = async () => {
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

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
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

        <Tabs defaultValue="scorecards" className="space-y-6">
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
                <CardTitle>Scorecard Configuration</CardTitle>
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
                    Choose which metrics count towards daily performance.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {ALL_METRICS.map(metric => (
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
                    How many targets must be hit to pass for the day?
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
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    {ALL_METRICS.map(metric => (
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
                  </div>
                </div>

                {/* Counted Days */}
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
                  <div className="mt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="count-weekend-submit"
                        checked={countWeekendIfSubmitted}
                        onCheckedChange={(checked) => setCountWeekendIfSubmitted(checked === true)}
                      />
                      <Label htmlFor="count-weekend-submit" className="text-sm">
                        Count weekend days if submission exists
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={saveScorecardSettings} disabled={saving || totalWeight !== 100}>
                    {saving ? "Saving..." : "Save Scorecard Settings"}
                  </Button>
                </div>
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