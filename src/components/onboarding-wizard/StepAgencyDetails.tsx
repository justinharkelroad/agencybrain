import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

interface StepAgencyDetailsProps {
  defaultAgencyName: string | null;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (agencyName: string, timezone: string, phone?: string) => void;
  onBack: () => void;
}

export function StepAgencyDetails({
  defaultAgencyName,
  isSubmitting,
  error,
  onSubmit,
  onBack,
}: StepAgencyDetailsProps) {
  const [agencyName, setAgencyName] = useState(defaultAgencyName || "");
  const [timezone, setTimezone] = useState("America/New_York");
  const [phone, setPhone] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!agencyName.trim()) {
      setLocalError("Agency name is required");
      return;
    }
    if (!phone.trim()) {
      setLocalError("Phone number is required");
      return;
    }

    onSubmit(agencyName.trim(), timezone, phone.trim());
  };

  const displayError = localError || error;

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Agency Details</h1>
        <p className="text-muted-foreground">
          Tell us about your agency
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="agencyName">Agency Name</Label>
          <Input
            id="agencyName"
            type="text"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="Smith Insurance Agency"
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {US_TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
          />
        </div>

        {displayError && (
          <p className="text-sm text-destructive">{displayError}</p>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting}
            className="flex-1"
          >
            Back
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
