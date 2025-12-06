
import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Edit, Plus, Trash2, ArrowRight, Building2, Users, FileText, ShieldCheck, Settings, Eye, EyeOff, Key, UserX, UserCheck, Mail, Send, RefreshCw, Clock, Loader2 } from "lucide-react";
import { AgencyTemplatesManager } from "@/components/checklists/AgencyTemplatesManager";
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

interface StaffUser {
  id: string;
  username: string;
  is_active: boolean;
  last_login_at: string | null;
  email: string | null;
  team_member_id: string | null;
}

const generateRandomPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Password copied to clipboard");
  } catch (err) {
    toast.error("Failed to copy to clipboard");
  }
};

export default function Agency() {
  const { user } = useAuth();
  const { toast: toastHook } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeTab = searchParams.get('tab') || 'info';

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Agency form state
  const [agencyName, setAgencyName] = useState("");
  const [agencyEmail, setAgencyEmail] = useState("");
  const [agencyPhone, setAgencyPhone] = useState("");

  // Team state
  const [members, setMembers] = useState<any[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
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

  // Staff Invite dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [manageLoginDialogOpen, setManageLoginDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedStaffUser, setSelectedStaffUser] = useState<StaffUser | null>(null);

  // Reset password state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Build staff user lookup map
  const staffByTeamMemberId = useMemo(() => {
    return new Map(staffUsers.filter(s => s.team_member_id).map(s => [s.team_member_id, s]));
  }, [staffUsers]);

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

  // Load profile -> agency -> members -> staff users
  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("agency_id")
          .eq("id", user.id)
          .maybeSingle();
        if (pErr) throw pErr;
        const aId = profile?.agency_id as string | null;
        setAgencyId(aId || null);

        if (aId) {
          const { data: agency, error: aErr } = await supabase
            .from("agencies")
            .select("id,name,agency_email,phone")
            .eq("id", aId)
            .maybeSingle();
          if (aErr) throw aErr;
          setAgencyName(agency?.name || "");
          setAgencyEmail(agency?.agency_email || "");
          setAgencyPhone(agency?.phone || "");

          const { data: team, error: tErr } = await supabase
            .from("team_members")
            .select("id,name,email,role,employment,status,notes,hybrid_team_assignments,created_at")
            .eq("agency_id", aId)
            .order("created_at", { ascending: false });
          if (tErr) throw tErr;
          setMembers(team || []);

          // Fetch staff users separately (no FK constraint)
          const { data: staff, error: sErr } = await supabase
            .from("staff_users")
            .select("id, username, is_active, last_login_at, email, team_member_id")
            .eq("agency_id", aId);
          if (!sErr) setStaffUsers(staff || []);
        }
      } catch (e: any) {
        console.error(e);
        toastHook({ title: "Failed to load", description: e?.message || "Unable to load agency", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user?.id]);

  const refreshData = async (aId: string) => {
    const { data: team, error: tErr } = await supabase
      .from("team_members")
      .select("id,name,email,role,employment,status,notes,hybrid_team_assignments,created_at")
      .eq("agency_id", aId)
      .order("created_at", { ascending: false });
    if (!tErr) setMembers(team || []);

    const { data: staff, error: sErr } = await supabase
      .from("staff_users")
      .select("id, username, is_active, last_login_at, email, team_member_id")
      .eq("agency_id", aId);
    if (!sErr) setStaffUsers(staff || []);
  };

  const upsertAgency = async () => {
    try {
      if (!user?.id) return;
      if (!agencyName.trim()) {
        toastHook({ title: "Name required", description: "Enter your agency name.", variant: "destructive" });
        return;
      }
      if (agencyId) {
      const { error } = await supabase
          .from("agencies")
          .update({ name: agencyName.trim(), agency_email: agencyEmail.trim() || null, phone: agencyPhone.trim() || null })
          .eq("id", agencyId);
        if (error) throw error;
        toastHook({ title: "Saved", description: "Agency updated" });
      } else {
        const { data, error } = await supabase
          .from("agencies")
          .insert([{ name: agencyName.trim(), agency_email: agencyEmail.trim() || null, phone: agencyPhone.trim() || null }])
          .select("id")
          .single();
        if (error) throw error;
        const newId = data.id as string;
        const { error: upErr } = await supabase.from("profiles").update({ agency_id: newId }).eq("id", user.id);
        if (upErr) throw upErr;
        setAgencyId(newId);
        toastHook({ title: "Created", description: "Agency created and linked" });
      }
    } catch (e: any) {
      console.error(e);
      toastHook({ title: "Save failed", description: e?.message || "Unable to save agency", variant: "destructive" });
    }
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
        const { error } = await supabase.from("team_members").update(updateData).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("team_members").insert([{ agency_id: agencyId, ...updateData }]);
        if (error) throw error;
      }
      await refreshData(agencyId);
      setMemberDialogOpen(false);
      toastHook({ title: "Saved", description: "Team member saved" });
    } catch (e: any) {
      console.error(e);
      toastHook({ title: "Save failed", description: e?.message || "Unable to save member", variant: "destructive" });
    }
  };

  const deleteMember = async (id: string) => {
    try {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
      if (agencyId) await refreshData(agencyId);
      toastHook({ title: "Deleted", description: "Team member removed" });
    } catch (e: any) {
      console.error(e);
      toastHook({ title: "Delete failed", description: e?.message || "Unable to delete member", variant: "destructive" });
    }
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // Staff Invite handlers
  const openInviteModal = (member: any) => {
    setSelectedMember(member);
    setInviteDialogOpen(true);
  };

  const openManageLoginModal = (member: any, staffUser: StaffUser) => {
    setSelectedMember(member);
    setSelectedStaffUser(staffUser);
    setManageLoginDialogOpen(true);
  };

  const handleSendInvite = async () => {
    try {
      if (!selectedMember || !agencyId) return;
      
      if (!selectedMember.email) {
        toast.error("Team member has no email address");
        return;
      }

      setInviteLoading(true);

      const { data, error } = await supabase.functions.invoke("send_staff_invite", {
        body: {
          team_member_id: selectedMember.id,
          agency_id: agencyId,
        },
      });

      if (error) throw error;
      
      if (!data?.success) {
        toast.error(data?.error || "Failed to send invite");
        return;
      }

      toast.success(`Invite sent to ${selectedMember.email}`);
      setInviteDialogOpen(false);
      setSelectedMember(null);
      await refreshData(agencyId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to send invite");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleResendInvite = async (member: any) => {
    try {
      if (!agencyId) return;
      
      if (!member.email) {
        toast.error("Team member has no email address");
        return;
      }

      const { data, error } = await supabase.functions.invoke("send_staff_invite", {
        body: {
          team_member_id: member.id,
          agency_id: agencyId,
        },
      });

      if (error) throw error;
      
      if (!data?.success) {
        toast.error(data?.error || "Failed to resend invite");
        return;
      }

      toast.success(`Invite resent to ${member.email}`);
      await refreshData(agencyId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to resend invite");
    }
  };

  const handleResetPassword = async () => {
    try {
      if (!selectedStaffUser || !newPassword) {
        toast.error("Password is required");
        return;
      }
      if (newPassword.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }

      const { error } = await supabase.functions.invoke("admin_reset_staff_password", {
        body: {
          user_id: selectedStaffUser.id,
          new_password: newPassword,
        },
      });

      if (error) throw error;

      await copyToClipboard(newPassword);
      toast.success("Password reset! New password copied to clipboard.");
      setResetDialogOpen(false);
      setNewPassword("");
      setShowNewPassword(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to reset password");
    }
  };

  const handleSendResetEmail = async () => {
    try {
      if (!selectedStaffUser?.email) {
        toast.error("Staff user has no email configured");
        return;
      }

      const { error } = await supabase.functions.invoke("staff_request_password_reset", {
        body: { email: selectedStaffUser.email },
      });

      if (error) throw error;
      toast.success("Password reset email sent!");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to send reset email");
    }
  };

  const handleToggleActive = async () => {
    try {
      if (!selectedStaffUser || !agencyId) return;

      const { error } = await supabase
        .from("staff_users")
        .update({ is_active: !selectedStaffUser.is_active })
        .eq("id", selectedStaffUser.id);

      if (error) throw error;

      toast.success(selectedStaffUser.is_active ? "Staff login deactivated" : "Staff login activated");
      setManageLoginDialogOpen(false);
      setSelectedStaffUser(null);
      await refreshData(agencyId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to update status");
    }
  };

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-6">
        <h1 className="sr-only">My Agency</h1>
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
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
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="agency-name" className="sm:text-right">Name</Label>
              <Input id="agency-name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="col-span-1 sm:col-span-3" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="agency-email" className="sm:text-right">Email</Label>
              <Input id="agency-email" type="email" value={agencyEmail} onChange={(e) => setAgencyEmail(e.target.value)} className="col-span-1 sm:col-span-3" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="agency-phone" className="sm:text-right">Phone</Label>
              <Input id="agency-phone" value={agencyPhone} onChange={(e) => setAgencyPhone(e.target.value)} className="col-span-1 sm:col-span-3" />
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
                  <CardDescription>Manage your roster and staff logins</CardDescription>
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
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label className="sm:text-right" htmlFor="name">Name</Label>
                    <Input id="name" value={memberForm.name} onChange={(e) => setMemberForm((f) => ({ ...f, name: e.target.value }))} className="col-span-1 sm:col-span-3" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label className="sm:text-right" htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={memberForm.email} onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))} className="col-span-1 sm:col-span-3" />
                  </div>
                   <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                     <Label className="sm:text-right">Role</Label>
                     <Select value={memberForm.role} onValueChange={(v) => setMemberForm((f) => ({ ...f, role: v as Role }))}>
                       <SelectTrigger className="col-span-1 sm:col-span-3"><SelectValue placeholder="Select role" /></SelectTrigger>
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
                   <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                     <Label className="sm:text-right">Employment</Label>
                     <Select value={memberForm.employment} onValueChange={(v) => setMemberForm((f) => ({ ...f, employment: v as Employment }))}>
                       <SelectTrigger className="col-span-1 sm:col-span-3"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_TYPES.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                   <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                     <Label className="sm:text-right">Status</Label>
                     <Select value={memberForm.status} onValueChange={(v) => setMemberForm((f) => ({ ...f, status: v as MemberStatus }))}>
                       <SelectTrigger className="col-span-1 sm:col-span-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        {MEMBER_STATUS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                   <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-3">
                     <Label className="sm:text-right" htmlFor="notes">Notes</Label>
                     <Textarea id="notes" value={memberForm.notes} onChange={(e) => setMemberForm((f) => ({ ...f, notes: e.target.value }))} className="col-span-1 sm:col-span-3 min-h-[84px]" />
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
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Employment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Staff Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const staffUser = staffByTeamMemberId.get(m.id);
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Link to={`/agency/team/${m.id}`} className="text-primary hover:underline">{m.name}</Link>
                      </TableCell>
                      <TableCell>{m.email}</TableCell>
                      <TableCell>{m.role}{m.role === 'Hybrid' && m.hybrid_team_assignments?.length > 0 && ` (${m.hybrid_team_assignments.join(', ')})`}</TableCell>
                      <TableCell>{m.employment}</TableCell>
                      <TableCell>{m.status}</TableCell>
                      <TableCell>
                        {staffUser ? (
                          staffUser.is_active ? (
                            // Active staff login
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className="bg-green-500/10 text-green-500 border-green-500/20"
                              >
                                ✅ {staffUser.username}
                              </Badge>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openManageLoginModal(m, staffUser)}
                              >
                                Manage
                              </Button>
                            </div>
                          ) : (
                            // Invite pending (inactive staff user)
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className="bg-amber-500/10 text-amber-600 border-amber-500/20"
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                Invite Pending
                              </Badge>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleResendInvite(m)}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Resend
                              </Button>
                            </div>
                          )
                        ) : (
                          // No staff user - show invite button
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openInviteModal(m)}
                            disabled={!m.email}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Invite
                          </Button>
                        )}
                      </TableCell>
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
                  );
                })}
                {!loading && members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">No team members yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
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

    {/* Invite Staff Dialog */}
    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
      <DialogContent className="glass-surface">
        <DialogHeader>
          <DialogTitle>Invite {selectedMember?.name} to Agency Brain</DialogTitle>
          <DialogDescription>
            Send an email invitation to set up their staff portal access.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">An email will be sent to:</p>
            <p className="font-medium">{selectedMember?.email}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            They'll receive a link to set their password and access the staff portal. The invite expires in 7 days.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSendInvite} disabled={inviteLoading}>
            {inviteLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Invite
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Manage Login Dialog */}
    <Dialog open={manageLoginDialogOpen} onOpenChange={setManageLoginDialogOpen}>
      <DialogContent className="glass-surface">
        <DialogHeader>
          <DialogTitle>Manage Login: {selectedStaffUser?.username}</DialogTitle>
          <DialogDescription>
            Manage staff credentials for {selectedMember?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status</span>
            <Badge 
              variant="outline" 
              className={selectedStaffUser?.is_active 
                ? "bg-green-500/10 text-green-500 border-green-500/20" 
                : "bg-muted text-muted-foreground"
              }
            >
              {selectedStaffUser?.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Last Login</span>
            <span className="text-sm">
              {selectedStaffUser?.last_login_at 
                ? new Date(selectedStaffUser.last_login_at).toLocaleString()
                : "Never"
              }
            </span>
          </div>
          {selectedStaffUser?.email && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Email</span>
              <span className="text-sm">{selectedStaffUser.email}</span>
            </div>
          )}
          <div className="border-t pt-4 space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                setNewPassword(generateRandomPassword());
                setShowNewPassword(true);
                setResetDialogOpen(true);
              }}
            >
              <Key className="h-4 w-4 mr-2" />
              Reset Password
            </Button>
            {selectedStaffUser?.email && (
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleSendResetEmail}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Password Reset Email
              </Button>
            )}
            <Button 
              variant={selectedStaffUser?.is_active ? "destructive" : "outline"}
              className="w-full justify-start"
              onClick={handleToggleActive}
            >
              {selectedStaffUser?.is_active ? (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  Deactivate Login
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Activate Login
                </>
              )}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setManageLoginDialogOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Reset Password Dialog */}
    <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
      <DialogContent className="glass-surface">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for {selectedStaffUser?.username}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-4 items-center gap-3">
            <Label className="text-right">New Password</Label>
            <div className="col-span-3 flex gap-2">
              <div className="relative flex-1">
                <Input 
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  const pwd = generateRandomPassword();
                  setNewPassword(pwd);
                  copyToClipboard(pwd);
                }}
              >
                Generate
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleResetPassword}>Reset Password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </main>
</div>
);
}
