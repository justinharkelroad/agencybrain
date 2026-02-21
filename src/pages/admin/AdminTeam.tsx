import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, UserX, UserCheck } from "lucide-react";
import { EmailDeliveryNoticeButton } from "@/components/EmailDeliveryNoticeModal";
import { normalizePersonName } from "@/lib/nameFormatting";

// Enums from Supabase types
const MEMBER_ROLES = ["Sales", "Service", "Hybrid", "Manager"] as const;
const EMPLOYMENT_TYPES = ["Full-time", "Part-time"] as const;
const MEMBER_STATUS = ["active", "inactive"] as const;

type Role = (typeof MEMBER_ROLES)[number];
type Employment = (typeof EMPLOYMENT_TYPES)[number];
type MemberStatus = (typeof MEMBER_STATUS)[number];

type FormState = {
  name: string;
  email: string;
  role: Role;
  employment: Employment;
  status: MemberStatus;
  notes: string;
  hybridTeamAssignments: string[];
  subProducerCode: string;
  includeInMetrics: boolean;
};

export default function AdminTeam() {
  const { user } = useAuth();
  const { toast: toastHook } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    document.title = "Team Members | Admin";
    const meta = document.querySelector('meta[name="description"]');
    const content = "Manage agency team members: add, update, and remove";
    if (meta) meta.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
  }, []);

  const { data: agencyId } = useQuery({
    queryKey: ["agency-id", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("agency_id").eq("id", user!.id).single();
      if (error) throw error;
      return data?.agency_id as string | null;
    },
  });

  const membersQuery = useQuery({
    queryKey: ["team-members", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id,name,email,role,employment,status,notes,hybrid_team_assignments,sub_producer_code,include_in_metrics,created_at")
        .eq("agency_id", agencyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!agencyId) return;
    const channel = supabase
      .channel("admin-team-members")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_members", filter: `agency_id=eq.${agencyId}` },
        () => qc.invalidateQueries({ queryKey: ["team-members", agencyId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [agencyId, qc]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [memberToDeactivate, setMemberToDeactivate] = useState<any>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    role: MEMBER_ROLES[0] as Role,
    employment: EMPLOYMENT_TYPES[0] as Employment,
    status: MEMBER_STATUS[0] as MemberStatus,
    notes: "",
    hybridTeamAssignments: [],
    subProducerCode: "",
    includeInMetrics: true,
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", email: "", role: MEMBER_ROLES[0] as Role, employment: EMPLOYMENT_TYPES[0] as Employment, status: MEMBER_STATUS[0] as MemberStatus, notes: "", hybridTeamAssignments: [], subProducerCode: "", includeInMetrics: true });
  };

  const startCreate = () => {
    resetForm();
    setOpen(true);
  };

  const startEdit = (m: any) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      email: m.email,
      role: m.role,
      employment: m.employment,
      status: m.status,
      notes: m.notes || "",
      hybridTeamAssignments: m.hybrid_team_assignments || [],
      subProducerCode: m.sub_producer_code || "",
      includeInMetrics: m.include_in_metrics ?? true
    });
    setOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!agencyId) throw new Error("No agency configured");
      if (!form.name.trim() || !form.email.trim()) throw new Error("Name and email are required");
      const normalizedName = normalizePersonName(form.name);
      const updateData = {
        name: normalizedName,
        email: form.email,
        role: form.role,
        employment: form.employment,
        status: form.status,
        notes: form.notes,
        hybrid_team_assignments: form.role === 'Hybrid' ? form.hybridTeamAssignments : null,
        sub_producer_code: form.subProducerCode || null,
        include_in_metrics: form.includeInMetrics
      };
      
      if (editingId) {
        const { error } = await supabase.from("team_members").update(updateData).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("team_members").insert([{ agency_id: agencyId, ...updateData }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members", agencyId] });
      toastHook({ title: "Saved", description: "Team member saved successfully" });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toastHook({ title: "Save failed", description: e?.message || "Unable to save member", variant: "destructive" }),
  });

  const openDeactivateDialog = (member: any) => {
    setMemberToDeactivate(member);
    setDeactivateDialogOpen(true);
  };

  const deactivateMember = async () => {
    if (!memberToDeactivate) return;
    
    try {
      // Update team member status to inactive
      const { error: memberError } = await supabase
        .from("team_members")
        .update({ status: 'inactive' })
        .eq("id", memberToDeactivate.id);
      
      if (memberError) throw memberError;
      
      // Also deactivate their staff login if they have one
      const { error: staffError } = await supabase
        .from("staff_users")
        .update({ is_active: false })
        .eq("team_member_id", memberToDeactivate.id);
      
      if (staffError && staffError.code !== 'PGRST116') {
        console.error("Failed to deactivate staff login:", staffError);
      }
      
      toast.success(`${memberToDeactivate.name} has been deactivated`);
      qc.invalidateQueries({ queryKey: ["team-members", agencyId] });
    } catch (e: any) {
      console.error("Deactivate member error:", e);
      toast.error("Failed to deactivate team member");
    } finally {
      setDeactivateDialogOpen(false);
      setMemberToDeactivate(null);
    }
  };

  const reactivateMember = async (member: any) => {
    try {
      const { error } = await supabase
        .from("team_members")
        .update({ status: 'active' })
        .eq("id", member.id);
      
      if (error) throw error;
      
      toast.success(`${member.name} has been reactivated`);
      qc.invalidateQueries({ queryKey: ["team-members", agencyId] });
    } catch (e: any) {
      console.error("Reactivate member error:", e);
      toast.error("Failed to reactivate team member");
    }
  };

  const submit = () => upsertMutation.mutate();

  const title = useMemo(() => (editingId ? "Edit Member" : "Add Member"), [editingId]);

  return (
    <div>
      <main className="container mx-auto px-4 py-6">
        <article className="space-y-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold">Team Members</h1>
            <div className="flex flex-wrap items-center gap-2">
              <EmailDeliveryNoticeButton />
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button onClick={startCreate} className="rounded-full" aria-label="Add team member">
                    <Plus className="h-4 w-4 mr-2" /> Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-surface">
                  <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>Manage team member details</DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-2">
                    <div className="grid grid-cols-4 items-center gap-3">
                      <Label className="text-right" htmlFor="name">Name</Label>
                      <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-3">
                      <Label className="text-right" htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-3">
                       <Label className="text-right">Role</Label>
                       <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}>
                         <SelectTrigger className="col-span-3"><SelectValue placeholder="Select role" /></SelectTrigger>
                         <SelectContent>
                           {MEMBER_ROLES.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                         </SelectContent>
                       </Select>
                     </div>
                     
                     {form.role === 'Hybrid' && (
                       <div className="grid grid-cols-4 items-start gap-3">
                         <Label className="text-right">Teams</Label>
                         <div className="col-span-3 space-y-2">
                           <p className="text-sm text-muted-foreground">Select which team(s) this hybrid member counts for:</p>
                           <div className="flex items-center space-x-2">
                             <Checkbox 
                               id="sales-team"
                               checked={form.hybridTeamAssignments.includes('Sales')}
                               onCheckedChange={(checked) => {
                                 setForm(f => ({
                                   ...f,
                                   hybridTeamAssignments: checked 
                                     ? [...f.hybridTeamAssignments, 'Sales']
                                     : f.hybridTeamAssignments.filter(t => t !== 'Sales')
                                 }));
                               }}
                             />
                             <Label htmlFor="sales-team">Sales Team</Label>
                           </div>
                           <div className="flex items-center space-x-2">
                             <Checkbox 
                               id="service-team"
                               checked={form.hybridTeamAssignments.includes('Service')}
                               onCheckedChange={(checked) => {
                                 setForm(f => ({
                                   ...f,
                                   hybridTeamAssignments: checked 
                                     ? [...f.hybridTeamAssignments, 'Service']
                                     : f.hybridTeamAssignments.filter(t => t !== 'Service')
                                 }));
                               }}
                             />
                             <Label htmlFor="service-team">Service Team</Label>
                           </div>
                         </div>
                       </div>
                     )}
                    <div className="grid grid-cols-4 items-center gap-3">
                      <Label className="text-right" htmlFor="subProducerCode">Sub Producer Code</Label>
                      <Input 
                        id="subProducerCode" 
                        value={form.subProducerCode} 
                        onChange={(e) => setForm((f) => ({ ...f, subProducerCode: e.target.value }))} 
                        className="col-span-3"
                        placeholder="e.g., 401, 402 (optional)"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-3">
                      <Label className="text-right">Employment</Label>
                      <Select value={form.employment} onValueChange={(v) => setForm((f) => ({ ...f, employment: v as Employment }))}>
                        <SelectTrigger className="col-span-3"><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          {EMPLOYMENT_TYPES.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-3">
                      <Label className="text-right">Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as MemberStatus }))}>
                        <SelectTrigger className="col-span-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                        <SelectContent>
                          {MEMBER_STATUS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-3">
                      <Label className="text-right" htmlFor="includeInMetrics">Include in Metrics</Label>
                      <div className="col-span-3 flex items-center gap-3">
                        <Switch
                          id="includeInMetrics"
                          checked={form.includeInMetrics}
                          onCheckedChange={(checked) => setForm((f) => ({ ...f, includeInMetrics: checked }))}
                        />
                        <span className="text-sm text-muted-foreground">
                          {form.includeInMetrics ? "Included in dashboards and compliance tracking" : "Excluded from metrics (can still submit forms)"}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-start gap-3">
                      <Label className="text-right" htmlFor="notes">Notes</Label>
                      <Textarea id="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="col-span-3 min-h-[84px]" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                    <Button variant="default" onClick={submit} disabled={upsertMutation.isPending}>{upsertMutation.isPending ? "Saving..." : "Save"}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <CardDescription>All members in your agency</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>Agency team members</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Sub-Prod Code</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Employment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersQuery.data?.map((m: any) => (
                    <TableRow key={m.id} className={m.status === 'inactive' ? 'opacity-60' : ''}>
                      <TableCell>{m.name}</TableCell>
                      <TableCell>
                        {m.sub_producer_code ? (
                          <Badge variant="outline" className="font-mono">
                            {m.sub_producer_code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{m.email}</TableCell>
                      <TableCell>{m.role}{m.role === 'Hybrid' && m.hybrid_team_assignments?.length > 0 && ` (${m.hybrid_team_assignments.join(', ')})`}</TableCell>
                      <TableCell>{m.employment}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {m.status === 'inactive' ? (
                            <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/20">Deactivated</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>
                          )}
                          {m.include_in_metrics === false && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Excluded from metrics</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/admin/team/${m.id}`}>
                            <Button variant="flat" size="sm" className="rounded-full">View</Button>
                          </Link>
                          <Button variant="secondary" size="icon" className="rounded-full" aria-label="Edit" onClick={() => startEdit(m)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {m.status === 'inactive' ? (
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="rounded-full text-green-600 border-green-600/30 hover:bg-green-500/10" 
                              aria-label="Reactivate" 
                              onClick={() => reactivateMember(m)}
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="rounded-full text-destructive border-destructive/30 hover:bg-destructive/10" 
                              aria-label="Deactivate" 
                              onClick={() => openDeactivateDialog(m)}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!membersQuery.isLoading && membersQuery.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">No team members yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </article>
      </main>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <strong>{memberToDeactivate?.name}</strong> and revoke their staff login if they have one. Their historical data will be preserved and they can be reactivated later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMemberToDeactivate(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deactivateMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
