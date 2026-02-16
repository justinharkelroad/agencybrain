import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CredentialDisplay } from "@/components/challenge/CredentialDisplay";
import { toast } from "sonner";
import { Plus, Trash2, Gift, Loader2, Copy, Check, ExternalLink } from "lucide-react";

interface TeamMemberInput {
  name: string;
  email: string;
}

interface CompResult {
  success: boolean;
  agency_id: string;
  user_id: string;
  purchase_id: string;
  owner_setup_url: string;
  start_date: string;
  quantity: number;
  credentials: Array<{ name: string; username: string; password: string }>;
}

// Get next 8 Mondays from today
function getNextMondays(count: number): Date[] {
  const mondays: Date[] = [];
  const today = new Date();
  const current = new Date(today);
  const dayOfWeek = current.getDay();
  // Get to next Monday
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : (8 - dayOfWeek);
  current.setDate(current.getDate() + daysUntilMonday);
  current.setHours(0, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    mondays.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return mondays;
}

function formatMonday(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
];

export function ChallengeCompTab() {
  // Form state
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [useExistingAgency, setUseExistingAgency] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [teamMembers, setTeamMembers] = useState<TeamMemberInput[]>([]);
  const [result, setResult] = useState<CompResult | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const mondays = useMemo(() => getNextMondays(8), []);

  // Fetch agencies for dropdown
  const { data: agencies } = useQuery({
    queryKey: ['admin-agencies-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const compMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('challenge-admin-comp', { body });
      if (error) {
        // FunctionsHttpError has the response body in error.context
        let message = error.message || 'Failed to create comp account';
        try {
          const errorData = await (error as any).context?.json?.();
          if (errorData?.error) message = errorData.error;
        } catch { /* ignore parse failures */ }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      return data as CompResult;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Comp account created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create comp account');
    },
  });

  const handleAddMember = () => {
    setTeamMembers([...teamMembers, { name: '', email: '' }]);
  };

  const handleRemoveMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const handleMemberChange = (index: number, field: 'name' | 'email', value: string) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    setTeamMembers(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const body: Record<string, unknown> = {
      owner_email: ownerEmail.trim(),
      owner_name: ownerName.trim(),
      quantity,
      start_date: startDate,
      timezone,
    };

    if (useExistingAgency) {
      body.agency_id = selectedAgencyId;
    } else {
      body.agency_name = agencyName.trim();
    }

    const validMembers = teamMembers.filter(m => m.name.trim());
    if (validMembers.length > 0) {
      body.team_members = validMembers.map(m => ({
        name: m.name.trim(),
        email: m.email.trim() || undefined,
      }));
    }

    compMutation.mutate(body);
  };

  const handleReset = () => {
    setOwnerEmail('');
    setOwnerName('');
    setUseExistingAgency(false);
    setSelectedAgencyId('');
    setAgencyName('');
    setQuantity(1);
    setStartDate('');
    setTimezone('America/New_York');
    setTeamMembers([]);
    setResult(null);
    compMutation.reset();
  };

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const canSubmit = ownerEmail.trim() &&
    ownerName.trim() &&
    startDate &&
    (useExistingAgency ? selectedAgencyId : agencyName.trim()) &&
    !compMutation.isPending;

  // Show result screen after success
  if (result) {
    return (
      <div className="space-y-6">
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Gift className="h-5 w-5" />
              Comp Account Created
            </CardTitle>
            <CardDescription>
              Account for <strong>{ownerEmail}</strong> is ready. Share the setup URL below so they can set their password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.owner_setup_url && (
              <div className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-lg p-3 border">
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Owner Password Setup URL</p>
                  <p className="text-sm font-mono truncate">{result.owner_setup_url}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleCopyUrl(result.owner_setup_url)}
                >
                  {copiedUrl ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Start Date:</span>{' '}
                <strong>{result.start_date}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Seats:</span>{' '}
                <strong>{result.quantity}</strong>
              </div>
            </div>
          </CardContent>
        </Card>

        {result.credentials.length > 0 && (
          <CredentialDisplay credentials={result.credentials} />
        )}

        <Button onClick={handleReset} variant="outline" className="w-full">
          Create Another Comp Account
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section 1: Owner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Owner Account</CardTitle>
          <CardDescription>The person who will own this challenge account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="owner-name">Full Name</Label>
              <Input
                id="owner-name"
                placeholder="John Smith"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-email">Email</Label>
              <Input
                id="owner-email"
                type="email"
                placeholder="john@example.com"
                value={ownerEmail}
                onChange={e => setOwnerEmail(e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Agency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agency</CardTitle>
          <CardDescription>Use an existing agency or create a new one</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="use-existing"
              checked={useExistingAgency}
              onCheckedChange={setUseExistingAgency}
            />
            <Label htmlFor="use-existing">Use existing agency</Label>
          </div>
          {useExistingAgency ? (
            <div className="space-y-2">
              <Label>Select Agency</Label>
              <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agency..." />
                </SelectTrigger>
                <SelectContent>
                  {agencies?.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="agency-name">Agency Name</Label>
              <Input
                id="agency-name"
                placeholder="Smith Insurance Agency"
                value={agencyName}
                onChange={e => setAgencyName(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Challenge Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Challenge Configuration</CardTitle>
          <CardDescription>Set up the challenge timing and seats</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Number of Seats</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label>Start Date (Monday)</Label>
              <Select value={startDate} onValueChange={setStartDate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a Monday..." />
                </SelectTrigger>
                <SelectContent>
                  {mondays.map(m => (
                    <SelectItem key={toISODate(m)} value={toISODate(m)}>
                      {formatMonday(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz} value={tz}>{tz.replace('America/', '').replace('Pacific/', '').replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Team Members (optional) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Team Members</CardTitle>
              <CardDescription>Optionally pre-create staff accounts (can also be done later by the owner)</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddMember} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Add Member
            </Button>
          </div>
        </CardHeader>
        {teamMembers.length > 0 && (
          <CardContent className="space-y-3">
            {teamMembers.map((member, index) => (
              <div key={index} className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    placeholder="Team member name"
                    value={member.name}
                    onChange={e => handleMemberChange(index, 'name', e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Email (optional)</Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={member.email}
                    onChange={e => handleMemberChange(index, 'email', e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveMember(index)}
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Submit */}
      <Button
        type="submit"
        disabled={!canSubmit}
        className="w-full gap-2"
        size="lg"
      >
        {compMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating Comp Account...
          </>
        ) : (
          <>
            <Gift className="h-4 w-4" />
            Create Comp Account
          </>
        )}
      </Button>
    </form>
  );
}
