import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export interface SalesManagerData {
  ownerOnCalls: boolean;
  manager?: { name: string; email: string; phone: string };
}

export interface SalesManagerResult {
  name: string;
  email: string;
  invite_url?: string;
  manager_team_member_id?: string;
}

interface StepSalesManagerProps {
  isSubmitting: boolean;
  error: string | null;
  savedManager: SalesManagerResult | null;
  onSubmit: (data: SalesManagerData) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function StepSalesManager({
  isSubmitting,
  error,
  savedManager,
  onSubmit,
  onBack,
  onContinue,
}: StepSalesManagerProps) {
  const [choice, setChoice] = useState<"owner" | "designate">("owner");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (choice === "designate") {
      if (!name.trim()) {
        setLocalError("Sales manager name is required");
        return;
      }
      if (!email.trim()) {
        setLocalError("Sales manager email is required");
        return;
      }
      if (!phone.trim()) {
        setLocalError("Sales manager phone is required");
        return;
      }
      onSubmit({
        ownerOnCalls: false,
        manager: { name: name.trim(), email: email.trim(), phone: phone.trim() },
      });
    } else {
      onSubmit({ ownerOnCalls: true });
    }
  };

  const copyInviteLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Invite link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // After manager is saved, show result with invite link
  if (savedManager) {
    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Sales Manager Added</h1>
          <p className="text-muted-foreground">
            Share the invite link so they can access the 8-Week Experience
          </p>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-card mb-6">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{savedManager.name}</p>
            <p className="text-sm text-muted-foreground truncate">
              {savedManager.email}
            </p>
          </div>
          {savedManager.invite_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyInviteLink(savedManager.invite_url!)}
              className="ml-3 shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy Invite Link
                </>
              )}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mb-6">
          Invite links expire in 7 days. You can resend invites from your Agency
          settings anytime.
        </p>

        <Button onClick={onContinue} className="w-full">
          Continue
        </Button>
      </div>
    );
  }

  const displayError = localError || error;

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Weekly Coaching Calls</h1>
        <p className="text-muted-foreground">
          Who will be on the weekly coaching Zoom calls?
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <RadioGroup
          value={choice}
          onValueChange={(val) => setChoice(val as "owner" | "designate")}
          className="space-y-3"
        >
          <label
            htmlFor="owner-on-calls"
            className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <RadioGroupItem value="owner" id="owner-on-calls" />
            <span className="text-sm font-medium">
              I will be on the coaching calls
            </span>
          </label>
          <label
            htmlFor="designate-manager"
            className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <RadioGroupItem value="designate" id="designate-manager" />
            <span className="text-sm font-medium">
              I'll designate a sales manager
            </span>
          </label>
        </RadioGroup>

        {choice === "designate" && (
          <div className="space-y-4 p-4 rounded-lg border bg-card">
            <p className="text-sm text-muted-foreground">
              This person will receive access to the 8-Week Experience inside
              AgencyBrain and will be responsible for attending the weekly
              coaching calls.
            </p>
            <div className="space-y-2">
              <Label htmlFor="mgr-name">Name</Label>
              <Input
                id="mgr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mgr-email">Email</Label>
              <Input
                id="mgr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@agency.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mgr-phone">Phone</Label>
              <Input
                id="mgr-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        )}

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
