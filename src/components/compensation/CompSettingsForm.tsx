import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

const AAP_LEVELS = [
  { value: "Elite", label: "Elite", description: "Highest tier with maximum rates" },
  { value: "Pro", label: "Pro", description: "Standard AAP rates" },
  { value: "Emerging", label: "Emerging", description: "Entry-level AAP rates" },
];

const AGENCY_TIERS = [
  { value: "1", label: "Tier 1" },
  { value: "2", label: "Tier 2" },
  { value: "3", label: "Tier 3" },
  { value: "4", label: "Tier 4" },
  { value: "4B", label: "Tier 4B" },
];

// States with special compensation rules
const NO_VARIABLE_COMP_STATES = ["NY", "NJ"];
const FLAT_RATE_STATES = ["CA", "CT", "FL"];
const DIFFERENT_HOME_CONDO_STATES = ["TX", "LA"];

interface CompSettings {
  id?: string;
  agency_id: string;
  state: string;
  aap_level: string;
  agency_tier: string | null;
  pif_count: number | null;
}

export function CompSettingsForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [settings, setSettings] = useState<CompSettings>({
    agency_id: "",
    state: "TX",
    aap_level: "Pro",
    agency_tier: null,
    pif_count: null,
  });

  useEffect(() => {
    if (user?.id) {
      loadAgencyAndSettings();
    }
  }, [user?.id]);

  const loadAgencyAndSettings = async () => {
    if (!user?.id) return;
    
    try {
      // First get the user's agency_id from their profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.agency_id) {
        setLoading(false);
        return;
      }

      setAgencyId(profile.agency_id);

      // Now load the comp settings
      const { data, error } = await supabase
        .from("agency_comp_settings")
        .select("*")
        .eq("agency_id", profile.agency_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
      } else {
        setSettings((prev) => ({ ...prev, agency_id: profile.agency_id }));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!agencyId) {
      toast.error("No agency found");
      return;
    }

    setSaving(true);
    try {
      const upsertData = {
        agency_id: agencyId,
        state: settings.state,
        aap_level: settings.aap_level,
        agency_tier: settings.agency_tier || null,
        pif_count: settings.pif_count || null,
      };

      const { error } = await supabase
        .from("agency_comp_settings")
        .upsert(upsertData, { onConflict: "agency_id" });

      if (error) throw error;

      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const getStateWarning = () => {
    if (NO_VARIABLE_COMP_STATES.includes(settings.state)) {
      return {
        type: "warning" as const,
        message: `${settings.state} does not allow variable compensation. Only base rates will apply.`,
      };
    }
    if (FLAT_RATE_STATES.includes(settings.state)) {
      return {
        type: "info" as const,
        message: `${settings.state} uses a flat rate structure instead of tiered rates.`,
      };
    }
    if (DIFFERENT_HOME_CONDO_STATES.includes(settings.state)) {
      return {
        type: "info" as const,
        message: `${settings.state} has different rates for home vs. condo policies.`,
      };
    }
    return null;
  };

  const stateWarning = getStateWarning();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Agency Compensation Settings</CardTitle>
          <CardDescription>
            Configure your agency's location and AAP level to accurately verify compensation rates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* State Selection */}
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Select
              value={settings.state}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, state: value }))}
            >
              <SelectTrigger id="state" className="w-full max-w-xs">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.label} ({state.value})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stateWarning && (
              <Alert variant={stateWarning.type === "warning" ? "destructive" : "default"} className="mt-2">
                {stateWarning.type === "warning" ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Info className="h-4 w-4" />
                )}
                <AlertDescription>{stateWarning.message}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* AAP Level */}
          <div className="space-y-3">
            <Label>AAP Level</Label>
            <RadioGroup
              value={settings.aap_level}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, aap_level: value }))}
              className="grid gap-3"
            >
              {AAP_LEVELS.map((level) => (
                <div key={level.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={level.value} id={`aap-${level.value}`} />
                  <Label htmlFor={`aap-${level.value}`} className="flex flex-col cursor-pointer">
                    <span className="font-medium">{level.label}</span>
                    <span className="text-sm text-muted-foreground">{level.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Agency Tier (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="tier">Agency Tier (Optional)</Label>
            <Select
              value={settings.agency_tier || ""}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, agency_tier: value || null }))
              }
            >
              <SelectTrigger id="tier" className="w-full max-w-xs">
                <SelectValue placeholder="Select tier (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {AGENCY_TIERS.map((tier) => (
                  <SelectItem key={tier.value} value={tier.value}>
                    {tier.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Used for additional rate verification in some compensation structures.
            </p>
          </div>

          {/* PIF Count (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="pif">PIF Count (Optional)</Label>
            <Input
              id="pif"
              type="number"
              min="0"
              placeholder="Enter PIF count"
              className="max-w-xs"
              value={settings.pif_count ?? ""}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  pif_count: e.target.value ? parseInt(e.target.value, 10) : null,
                }))
              }
            />
            <p className="text-sm text-muted-foreground">
              Policies in Force count for bonus tier calculations.
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Settings Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">State</dt>
              <dd className="font-medium">{settings.state}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">AAP Level</dt>
              <dd className="font-medium">{settings.aap_level}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Agency Tier</dt>
              <dd className="font-medium">{settings.agency_tier || "Not set"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">PIF Count</dt>
              <dd className="font-medium">
                {settings.pif_count?.toLocaleString() || "Not set"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
