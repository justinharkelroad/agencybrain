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
import { Loader2, Plus, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { TeamMemberResult } from "@/hooks/useOnboardingWizard";

const ROLES = ["Sales", "Service", "Hybrid", "Manager"] as const;

interface MemberRow {
  name: string;
  email: string;
  role: string;
}

interface StepAddTeamProps {
  isSubmitting: boolean;
  error: string | null;
  savedMembers: TeamMemberResult[];
  onSubmit: (members: MemberRow[]) => void;
  onSkip: () => void;
  onBack: () => void;
}

export function StepAddTeam({
  isSubmitting,
  error,
  savedMembers,
  onSubmit,
  onSkip,
  onBack,
}: StepAddTeamProps) {
  const [members, setMembers] = useState<MemberRow[]>([
    { name: "", email: "", role: "Sales" },
  ]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const showResults = savedMembers.length > 0;

  const addRow = () => {
    setMembers((prev) => [...prev, { name: "", email: "", role: "Sales" }]);
  };

  const removeRow = (idx: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof MemberRow, value: string) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = members.filter((m) => m.name.trim() && m.email.trim());
    if (valid.length === 0) {
      toast.error("Add at least one team member or skip this step");
      return;
    }
    onSubmit(valid);
  };

  const copyInviteLink = (url: string, idx: number) => {
    navigator.clipboard.writeText(url);
    setCopiedIdx(idx);
    toast.success("Invite link copied to clipboard");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // After members are saved, show results with invite links
  if (showResults) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Team Members Added</h1>
          <p className="text-muted-foreground">
            Share the invite links with your team so they can set up their staff portal access
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {savedMembers.map((member, idx) => (
            <div
              key={member.team_member_id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{member.name}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {member.email}
                </p>
              </div>
              {member.invite_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyInviteLink(member.invite_url!, idx)}
                  className="ml-3 shrink-0"
                >
                  {copiedIdx === idx ? (
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
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mb-6">
          Invite links expire in 7 days. You can resend invites from your Agency settings anytime.
        </p>

        <Button onClick={onSkip} className="w-full">
          Continue to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Add Your Team</h1>
        <p className="text-muted-foreground">
          Add team members who'll use the daily scorecard. You can always add more later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {members.map((member, idx) => (
          <div key={idx} className="p-4 rounded-lg border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Member {idx + 1}
              </span>
              {members.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(idx)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={member.name}
                  onChange={(e) => updateRow(idx, "name", e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={member.email}
                  onChange={(e) => updateRow(idx, "email", e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Select
                value={member.role}
                onValueChange={(val) => updateRow(idx, "role", val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addRow}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Member
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}

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
                Adding...
              </>
            ) : (
              "Add Team Members"
            )}
          </Button>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="block mx-auto text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          I'll do this later
        </button>
      </form>
    </div>
  );
}
