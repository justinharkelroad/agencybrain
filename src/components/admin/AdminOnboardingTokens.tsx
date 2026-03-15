import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Plus, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TIERS = ["Boardroom", "1:1 Coaching", "Call Scoring 30", "Call Scoring 50", "Call Scoring 100"];

interface OnboardingToken {
  id: string;
  token: string;
  email: string;
  agency_name: string | null;
  tier: string;
  status: string;
  stripe_customer_id: string | null;
  expires_at: string;
  created_at: string;
  used_at: string | null;
  used_by_agency_id: string | null;
}

export function AdminOnboardingTokens() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [tier, setTier] = useState("Boardroom");
  const [stripeCustomerId, setStripeCustomerId] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: tokens, isLoading } = useQuery({
    queryKey: ["onboarding-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_tokens")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OnboardingToken[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Insert directly via service role (admin is verified by RLS)
      const { data, error } = await supabase
        .from("onboarding_tokens")
        .insert({
          email: email.trim().toLowerCase(),
          agency_name: agencyName.trim() || null,
          tier,
          stripe_customer_id: stripeCustomerId.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-tokens"] });
      setDialogOpen(false);
      setEmail("");
      setAgencyName("");
      setTier("Boardroom");
      setStripeCustomerId("");

      // Auto-copy link
      const url = `${window.location.origin}/onboard?token=${data.token}`;
      navigator.clipboard.writeText(url);
      toast.success("Token created and link copied to clipboard");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create token");
    },
  });

  const copyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/onboard?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Onboarding link copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const statusBadge = (status: string, expiresAt: string) => {
    if (status === "used") return <Badge variant="default">Used</Badge>;
    if (status === "expired" || new Date(expiresAt) < new Date())
      return <Badge variant="secondary">Expired</Badge>;
    return <Badge variant="outline" className="border-green-500 text-green-600">Pending</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Onboarding Links</h2>
          <p className="text-sm text-muted-foreground">
            Generate self-service onboarding links for new clients
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Onboarding Link</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!email.trim()) {
                  toast.error("Email is required");
                  return;
                }
                createMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Client Email *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@agency.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Agency Name</Label>
                <Input
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="Smith Insurance Agency"
                />
              </div>

              <div className="space-y-2">
                <Label>Tier</Label>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Stripe Customer ID (optional)</Label>
                <Input
                  value={stripeCustomerId}
                  onChange={(e) => setStripeCustomerId(e.target.value)}
                  placeholder="cus_..."
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create & Copy Link"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !tokens?.length ? (
        <div className="text-center py-8 text-muted-foreground">
          No onboarding links generated yet
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.email}</TableCell>
                  <TableCell>{t.agency_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.tier}</Badge>
                  </TableCell>
                  <TableCell>{statusBadge(t.status, t.expires_at)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(t.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {t.status === "pending" &&
                        new Date(t.expires_at) > new Date() && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyLink(t.token, t.id)}
                            className="h-8 w-8 p-0"
                            title="Copy onboarding link"
                          >
                            {copiedId === t.id ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      {t.used_by_agency_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="View client"
                          onClick={() => {
                            window.location.href = `/admin/client/${t.used_by_agency_id}`;
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
