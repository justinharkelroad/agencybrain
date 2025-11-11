
import React, { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Plus, Trash2, ArrowRight, Building2, Users, FileText, ShieldCheck, Settings } from "lucide-react";
import { AgencyTemplatesManager } from "@/components/checklists/AgencyTemplatesManager";
import { ROIForecastersModal } from "@/components/ROIForecastersModal";
import { UploadsContent } from "@/components/UploadsContent";
import { ProcessVaultContent } from "@/components/ProcessVaultContent";
import { SettingsContent } from "@/components/SettingsContent";
// Reuse enums consistent with AdminTeam
const MEMBER_ROLES = ["Sales", "Service", "Hybrid", "Manager"] as const;
const EMPLOYMENT_TYPES = ["Full-time", "Part-time"] as const;
const MEMBER_STATUS = ["active", "inactive"] as const;

type Role = (typeof MEMBER_ROLES)[number];
type Employment = (typeof EMPLOYMENT_TYPES)[number];
type MemberStatus = (typeof MEMBER_STATUS)[number];

export default function Agency() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeTab = searchParams.get('tab') || 'info';

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roiOpen, setRoiOpen] = useState(false);

  // Agency form state
  const [agencyName, setAgencyName] = useState("");
  const [agencyEmail, setAgencyEmail] = useState("");
  const [agencyPhone, setAgencyPhone] = useState("");

  // Team state
  const [members, setMembers] = useState<any[]>([]);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    role: MEMBER_ROLES[0] as Role,
    employment: EMPLOYMENT_TYPES[0] as Employment,
    status: MEMBER_STATUS[0] as MemberStatus,
    notes: "",
    hybridTeamAssignments: [] as string[],
  });

  useEffect(() => {
    document.title = "My Agency | AgencyBrain";
    const meta = document.querySelector('meta[name="description"]');
    const content = "Manage your agency info and team from one workspace.";
    if (meta) meta.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
  }, []);

  // Load profile -> agency -> members
  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const { data: profile, error: pErr } = await supa
          .from("profiles")
          .select("agency_id")
          .eq("id", user.id)
          .maybeSingle();
        if (pErr) throw pErr;
        const aId = profile?.agency_id as string | null;
        setAgencyId(aId || null);

        if (aId) {
          const { data: agency, error: aErr } = await supa
            .from("agencies")
            .select("id,name,agency_email,phone")
            .eq("id", aId)
            .maybeSingle();
          if (aErr) throw aErr;
          setAgencyName(agency?.name || "");
          setAgencyEmail(agency?.agency_email || "");
          setAgencyPhone(agency?.phone || "");

          const { data: team, error: tErr } = await supa
            .from("team_members")
            .select("id,name,email,role,employment,status,notes,created_at")
            .eq("agency_id", aId)
            .order("created_at", { ascending: false });
          if (tErr) throw tErr;
          setMembers(team || []);
        }
      } catch (e: any) {
        console.error(e);
        toast({ title: "Failed to load", description: e?.message || "Unable to load agency", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user?.id]);

  const upsertAgency = async () => {
    try {
      if (!user?.id) return;
      if (!agencyName.trim()) {
        toast({ title: "Name required", description: "Enter your agency name.", variant: "destructive" });
        return;
      }
      if (agencyId) {
      const { error } = await supa
          .from("agencies")
          .update({ name: agencyName.trim(), agency_email: agencyEmail.trim() || null, phone: agencyPhone.trim() || null })
          .eq("id", agencyId);
        if (error) throw error;
        toast({ title: "Saved", description: "Agency updated" });
      } else {
        const { data, error } = await supa
          .from("agencies")
          .insert([{ name: agencyName.trim(), agency_email: agencyEmail.trim() || null, phone: agencyPhone.trim() || null }])
          .select("id")
          .single();
        if (error) throw error;
        const newId = data.id as string;
        const { error: upErr } = await supa.from("profiles").update({ agency_id: newId }).eq("id", user.id);
        if (upErr) throw upErr;
        setAgencyId(newId);
        toast({ title: "Created", description: "Agency created and linked" });
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "Save failed", description: e?.message || "Unable to save agency", variant: "destructive" });
    }
  };

  const refreshMembers = async (aId: string) => {
    const { data, error } = await supa
      .from("team_members")
      .select("id,name,email,role,employment,status,notes,hybrid_team_assignments,created_at")
      .eq("agency_id", aId)
      .order("created_at", { ascending: false });
    if (!error) setMembers(data || []);
  };

  const startCreate = () => {
    setEditingId(null);
    setMemberForm({ name: "", email: "", role: MEMBER_ROLES[0], employment: EMPLOYMENT_TYPES[0], status: MEMBER_STATUS[0], notes: "", hybridTeamAssignments: [] });
    setMemberDialogOpen(true);
  };

  const startEdit = (m: any) => {
    setEditingId(m.id);
    setMemberForm({ 
      name: m.name, 
      email: m.email, 
      role: m.role, 
      employment: m.employment, 
      status: m.status, 
      notes: m.notes || "",
      hybridTeamAssignments: m.hybrid_team_assignments || []
    });
    setMemberDialogOpen(true);
  };

  const saveMember = async () => {
    try {
      if (!agencyId) throw new Error("No agency configured");
      if (!memberForm.name.trim() || !memberForm.email.trim()) throw new Error("Name and email are required");
      const updateData = {
        name: memberForm.name,
        email: memberForm.email,
        role: memberForm.role,
        employment: memberForm.employment,
        status: memberForm.status,
        notes: memberForm.notes,
        hybrid_team_assignments: memberForm.role === 'Hybrid' ? memberForm.hybridTeamAssignments : null
      };
      
      if (editingId) {
        const { error } = await supa.from("team_members").update(updateData).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supa.from("team_members").insert([{ agency_id: agencyId, ...updateData }]);
        if (error) throw error;
      }
      await refreshMembers(agencyId);
      setMemberDialogOpen(false);
      toast({ title: "Saved", description: "Team member saved" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Save failed", description: e?.message || "Unable to save member", variant: "destructive" });
    }
  };

  const deleteMember = async (id: string) => {
    try {
      const { error } = await supa.from("team_members").delete().eq("id", id);
      if (error) throw error;
      if (agencyId) await refreshMembers(agencyId);
      toast({ title: "Deleted", description: "Team member removed" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Delete failed", description: e?.message || "Unable to delete member", variant: "destructive" });
    }
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="min-h-screen">
      <TopNav title="My Agency" onOpenROI={() => setRoiOpen(true)} />
      <main className="container mx-auto px-4 py-6">
        <h1 className="sr-only">My Agency</h1>
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Agency Info
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="vault" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Process Vault
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-6">

        <Card>
          <CardHeader>
            <CardTitle>Agency Information</CardTitle>
            <CardDescription>Update your agency profile</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="agency-name" className="text-right">Name</Label>
              <Input id="agency-name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="agency-email" className="text-right">Email</Label>
              <Input id="agency-email" type="email" value={agencyEmail} onChange={(e) => setAgencyEmail(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="agency-phone" className="text-right">Phone</Label>
              <Input id="agency-phone" value={agencyPhone} onChange={(e) => setAgencyPhone(e.target.value)} className="col-span-3" />
            </div>
            <div className="flex justify-end">
              <Button variant="gradient-glow" onClick={upsertAgency}>{agencyId ? "Save" : "Create Agency"}</Button>
            </div>
          </CardContent>
        </Card>

            <AgencyTemplatesManager />
          </TabsContent>

          <TabsContent value="team" className="space-y-6">

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Team</CardTitle>
                  <CardDescription>Manage your roster</CardDescription>
                </div>
                <Dialog open={memberDialogOpen} onOpenChange={(o) => { setMemberDialogOpen(o); if (!o) setEditingId(null); }}>
                  <DialogTrigger asChild>
                    <Button className="rounded-full" onClick={startCreate} disabled={!agencyId}>
                      <Plus className="h-4 w-4 mr-2" /> Add Member
                    </Button>
                  </DialogTrigger>
              <DialogContent className="glass-surface">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit Member" : "Add Member"}</DialogTitle>
                  <DialogDescription>Manage team member details</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-4 items-center gap-3">
                    <Label className="text-right" htmlFor="name">Name</Label>
                    <Input id="name" value={memberForm.name} onChange={(e) => setMemberForm((f) => ({ ...f, name: e.target.value }))} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-3">
                    <Label className="text-right" htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={memberForm.email} onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))} className="col-span-3" />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-3">
                     <Label className="text-right">Role</Label>
                     <Select value={memberForm.role} onValueChange={(v) => setMemberForm((f) => ({ ...f, role: v as Role }))}>
                       <SelectTrigger className="col-span-3"><SelectValue placeholder="Select role" /></SelectTrigger>
                       <SelectContent>
                         {MEMBER_ROLES.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                       </SelectContent>
                     </Select>
                   </div>
                   
                   {memberForm.role === 'Hybrid' && (
                     <div className="grid grid-cols-4 items-start gap-3">
                       <Label className="text-right">Teams</Label>
                       <div className="col-span-3 space-y-2">
                         <p className="text-sm text-muted-foreground">Select which team(s) this hybrid member counts for:</p>
                         <div className="flex items-center space-x-2">
                           <Checkbox 
                             id="sales-team-form"
                             checked={memberForm.hybridTeamAssignments.includes('Sales')}
                             onCheckedChange={(checked) => {
                               setMemberForm(f => ({
                                 ...f,
                                 hybridTeamAssignments: checked 
                                   ? [...f.hybridTeamAssignments, 'Sales']
                                   : f.hybridTeamAssignments.filter(t => t !== 'Sales')
                               }));
                             }}
                           />
                           <Label htmlFor="sales-team-form">Sales Team</Label>
                         </div>
                         <div className="flex items-center space-x-2">
                           <Checkbox 
                             id="service-team-form"
                             checked={memberForm.hybridTeamAssignments.includes('Service')}
                             onCheckedChange={(checked) => {
                               setMemberForm(f => ({
                                 ...f,
                                 hybridTeamAssignments: checked 
                                   ? [...f.hybridTeamAssignments, 'Service']
                                   : f.hybridTeamAssignments.filter(t => t !== 'Service')
                               }));
                             }}
                           />
                           <Label htmlFor="service-team-form">Service Team</Label>
                         </div>
                       </div>
                     </div>
                   )}
                  <div className="grid grid-cols-4 items-center gap-3">
                    <Label className="text-right">Employment</Label>
                    <Select value={memberForm.employment} onValueChange={(v) => setMemberForm((f) => ({ ...f, employment: v as Employment }))}>
                      <SelectTrigger className="col-span-3"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_TYPES.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-3">
                    <Label className="text-right">Status</Label>
                    <Select value={memberForm.status} onValueChange={(v) => setMemberForm((f) => ({ ...f, status: v as MemberStatus }))}>
                      <SelectTrigger className="col-span-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        {MEMBER_STATUS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-start gap-3">
                    <Label className="text-right" htmlFor="notes">Notes</Label>
                    <Textarea id="notes" value={memberForm.notes} onChange={(e) => setMemberForm((f) => ({ ...f, notes: e.target.value }))} className="col-span-3 min-h-[84px]" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>Cancel</Button>
                  <Button variant="gradient-glow" onClick={saveMember}>{editingId ? "Save" : "Add"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
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
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link to={`/agency/team/${m.id}`} className="text-primary hover:underline">{m.name}</Link>
                    </TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>{m.role}{m.role === 'Hybrid' && m.hybrid_team_assignments?.length > 0 && ` (${m.hybrid_team_assignments.join(', ')})`}</TableCell>
                    <TableCell>{m.employment}</TableCell>
                    <TableCell>{m.status}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/agency/team/${m.id}`} aria-label="View">
                          <Button variant="glass" size="icon" className="rounded-full">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="secondary" size="icon" className="rounded-full" aria-label="Edit" onClick={() => startEdit(m)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" className="rounded-full" aria-label="Delete" onClick={() => deleteMember(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No team members yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="files" className="space-y-6">
        <UploadsContent />
      </TabsContent>

      <TabsContent value="vault" className="space-y-6">
        <ProcessVaultContent />
      </TabsContent>

      <TabsContent value="settings" className="space-y-6">
        <SettingsContent />
      </TabsContent>
    </Tabs>
  </main>
  <ROIForecastersModal open={roiOpen} onOpenChange={setRoiOpen} />
</div>
);
}
