import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supa } from "@/lib/supabase";
import { AdminTopNav } from "@/components/AdminTopNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Edit, Plus } from "lucide-react";

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
};

export default function AdminTeam() {
  const { user } = useAuth();
  const { toast } = useToast();
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
        .select("id,name,email,role,employment,status,notes,hybrid_team_assignments,created_at")
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
const [form, setForm] = useState<FormState>({
  name: "",
  email: "",
  role: MEMBER_ROLES[0] as Role,
  employment: EMPLOYMENT_TYPES[0] as Employment,
  status: MEMBER_STATUS[0] as MemberStatus,
  notes: "",
  hybridTeamAssignments: [],
});

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", email: "", role: MEMBER_ROLES[0] as Role, employment: EMPLOYMENT_TYPES[0] as Employment, status: MEMBER_STATUS[0] as MemberStatus, notes: "", hybridTeamAssignments: [] });
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
      hybridTeamAssignments: m.hybrid_team_assignments || []
    });
    setOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!agencyId) throw new Error("No agency configured");
      if (!form.name.trim() || !form.email.trim()) throw new Error("Name and email are required");
      const updateData = {
        name: form.name,
        email: form.email,
        role: form.role,
        employment: form.employment,
        status: form.status,
        notes: form.notes,
        hybrid_team_assignments: form.role === 'Hybrid' ? form.hybridTeamAssignments : null
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
      toast({ title: "Saved", description: "Team member saved successfully" });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message || "Unable to save member", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members", agencyId] });
      toast({ title: "Deleted", description: "Team member removed" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e?.message || "Unable to delete member", variant: "destructive" }),
  });

  const submit = () => upsertMutation.mutate();

  const title = useMemo(() => (editingId ? "Edit Member" : "Add Member"), [editingId]);

  return (
    <div>
      <AdminTopNav title="Team Members" />
      <main className="container mx-auto px-4 py-6">
        <article className="space-y-6">
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Team Members</h1>
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
                  <div className="grid grid-cols-4 items-start gap-3">
                    <Label className="text-right" htmlFor="notes">Notes</Label>
                    <Textarea id="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="col-span-3 min-h-[84px]" />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                  <Button variant="gradient-glow" onClick={submit} disabled={upsertMutation.isPending}>{upsertMutation.isPending ? "Saving..." : "Save"}</Button>
                </div>
              </DialogContent>
            </Dialog>
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
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Employment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersQuery.data?.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.name}</TableCell>
                      <TableCell>{m.email}</TableCell>
                      <TableCell>{m.role}{m.role === 'Hybrid' && m.hybrid_team_assignments?.length > 0 && ` (${m.hybrid_team_assignments.join(', ')})`}</TableCell>
                      <TableCell>{m.employment}</TableCell>
                      <TableCell>{m.status}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/admin/team/${m.id}`}>
                            <Button variant="outline" size="sm" className="rounded-full">View</Button>
                          </Link>
                          <Button variant="secondary" size="icon" className="rounded-full" aria-label="Edit" onClick={() => startEdit(m)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" className="rounded-full" aria-label="Delete" onClick={() => deleteMutation.mutate(m.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}
