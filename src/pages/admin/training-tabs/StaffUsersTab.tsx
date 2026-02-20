import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCog, Eye, EyeOff, MoreVertical, Edit, Key, UserX, UserCheck, Mail, Link2, AlertTriangle, Loader2, ExternalLink, UserPlus, Send } from "lucide-react";
import { EmailDeliveryNoticeButton } from "@/components/EmailDeliveryNoticeModal";
import { useAgencyRosterWithStaffLogins, TeamMemberWithLogin, OrphanStaffUser } from "@/hooks/useAgencyRosterWithStaffLogins";
import { Link } from "react-router-dom";

interface StaffUsersTabProps {
  agencyId: string;
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

export function StaffUsersTab({ agencyId }: StaffUsersTabProps) {
  const queryClient = useQueryClient();

  // Use the new unified roster hook
  const { data: rosterData, isLoading } = useAgencyRosterWithStaffLogins(agencyId);
  const roster = rosterData?.roster || [];
  const orphanStaffUsers = rosterData?.orphanStaffUsers || [];

  // Grant access dialog state
  const [grantAccessDialogOpen, setGrantAccessDialogOpen] = useState(false);
  const [grantAccessMode, setGrantAccessMode] = useState<'invite' | 'password'>('invite');
  const [grantAccessMember, setGrantAccessMember] = useState<TeamMemberWithLogin | null>(null);
  const [grantAccessPassword, setGrantAccessPassword] = useState("");
  const [showGrantAccessPassword, setShowGrantAccessPassword] = useState(false);

  // Edit staff user dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStaffUser, setEditingStaffUser] = useState<TeamMemberWithLogin['staffUser'] | null>(null);
  const [editFormData, setEditFormData] = useState({ username: "", display_name: "", email: "" });

  // Reset password dialog
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetStaffUser, setResetStaffUser] = useState<TeamMemberWithLogin['staffUser'] | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Link orphan dialog
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkingOrphan, setLinkingOrphan] = useState<OrphanStaffUser | null>(null);
  const [linkTeamMemberId, setLinkTeamMemberId] = useState("");

  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);

  // Get team members without staff logins (for linking orphans)
  const unlinkedTeamMembers = roster.filter(m => m.loginStatus === 'none');

  // Send invite mutation
  const sendInvite = useMutation({
    mutationFn: async (teamMemberId: string) => {
      const { data, error } = await supabase.functions.invoke("send_staff_invite", {
        body: { team_member_id: teamMemberId, agency_id: agencyId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-roster-with-logins"] });
      toast.success("Invite sent successfully");
      setGrantAccessDialogOpen(false);
      setGrantAccessMember(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send invite");
    },
  });

  // Create staff user with password mutation
  const createStaffUserWithPassword = useMutation({
    mutationFn: async ({ teamMemberId, password }: { teamMemberId: string; password: string }) => {
      const member = roster.find(m => m.id === teamMemberId);
      if (!member) throw new Error("Team member not found");

      const { data, error } = await supabase.functions.invoke("admin_create_staff_user", {
        body: {
          agency_id: agencyId,
          username: member.name.toLowerCase().replace(/\s+/g, '.'),
          password,
          display_name: member.name,
          email: member.email || null,
          team_member_id: teamMemberId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-roster-with-logins"] });
      toast.success("Staff access created successfully");
      setGrantAccessDialogOpen(false);
      setGrantAccessMember(null);
      setGrantAccessPassword("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create staff access");
    },
  });

  // Edit staff user mutation
  const editStaffUser = useMutation({
    mutationFn: async ({ userId, userData }: { userId: string; userData: typeof editFormData }) => {
      const { error } = await supabase
        .from("staff_users")
        .update({
          username: userData.username,
          display_name: userData.display_name,
          email: userData.email || null,
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-roster-with-logins"] });
      toast.success("Staff user updated");
      setIsEditDialogOpen(false);
      setEditingStaffUser(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update staff user");
    },
  });

  // Reset password mutation
  const resetPassword = useMutation({
    mutationFn: async ({ userId, password, activate }: { userId: string; password: string; activate?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("admin_reset_staff_password", {
        body: { user_id: userId, new_password: password, ...(activate && { activate: true }) },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      // Copy password to clipboard before clearing state
      copyToClipboard(variables.password);
      toast.success(variables.activate ? "Password set and account activated! Password copied to clipboard." : "Password reset successfully. Password copied to clipboard.");
      queryClient.invalidateQueries({ queryKey: ["agency-roster-with-logins"] });
      setIsResetDialogOpen(false);
      setResetStaffUser(null);
      setNewPassword("");
      setShowNewPassword(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reset password");
    },
  });

  // Send reset email mutation
  const sendResetEmail = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("staff_request_password_reset", {
        body: { email },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Password reset email sent");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send reset email");
    },
  });

  // Toggle active mutation
  const toggleActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("staff_users")
        .update({ is_active: !isActive })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-roster-with-logins"] });
      toast.success("Staff user status updated");
    },
    onError: () => {
      toast.error("Failed to update staff user");
    },
  });

  // Link orphan to team member mutation
  const linkOrphan = useMutation({
    mutationFn: async ({ staffUserId, teamMemberId }: { staffUserId: string; teamMemberId: string }) => {
      const { data, error } = await supabase.functions.invoke("admin_link_staff_team_member", {
        body: { staff_user_id: staffUserId, team_member_id: teamMemberId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-roster-with-logins"] });
      toast.success("Staff user linked to team member");
      setIsLinkDialogOpen(false);
      setLinkingOrphan(null);
      setLinkTeamMemberId("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to link staff user");
    },
  });

  const handleGrantAccess = (member: TeamMemberWithLogin) => {
    setGrantAccessMember(member);
    setGrantAccessMode('invite');
    setGrantAccessPassword("");
    setShowGrantAccessPassword(false);
    setGrantAccessDialogOpen(true);
  };

  const handleResendInvite = (member: TeamMemberWithLogin) => {
    if (!member.staffUser) return;
    sendInvite.mutate(member.id);
  };

  const handleGrantAccessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantAccessMember) return;

    if (grantAccessMode === 'invite') {
      sendInvite.mutate(grantAccessMember.id);
    } else {
      if (grantAccessPassword.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
      createStaffUserWithPassword.mutate({
        teamMemberId: grantAccessMember.id,
        password: grantAccessPassword,
      });
    }
  };

  const handleGeneratePassword = () => {
    const password = generateRandomPassword();
    setGrantAccessPassword(password);
    setShowGrantAccessPassword(true);
    copyToClipboard(password);
  };

  const handleGenerateNewPassword = () => {
    const password = generateRandomPassword();
    setNewPassword(password);
    setShowNewPassword(true);
    copyToClipboard(password);
  };

  const handleEditStaffUser = (staffUser: TeamMemberWithLogin['staffUser']) => {
    if (!staffUser) return;
    setEditingStaffUser(staffUser);
    setEditFormData({
      username: staffUser.username,
      display_name: staffUser.display_name || "",
      email: staffUser.email || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaffUser || !editFormData.username) {
      toast.error("Username is required");
      return;
    }
    editStaffUser.mutate({ userId: editingStaffUser.id, userData: editFormData });
  };

  const handleResetPassword = (staffUser: TeamMemberWithLogin['staffUser']) => {
    if (!staffUser) return;
    setResetStaffUser(staffUser);
    setNewPassword("");
    setShowNewPassword(false);
    setIsResetDialogOpen(true);
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStaffUser || !newPassword) {
      toast.error("Password is required");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    const shouldActivate = !resetStaffUser.is_active;
    resetPassword.mutate({ userId: resetStaffUser.id, password: newPassword, ...(shouldActivate && { activate: true }) });
  };

  const handleSendResetEmail = (staffUser: TeamMemberWithLogin['staffUser']) => {
    if (!staffUser?.email) {
      toast.error("No email address for this user");
      return;
    }
    sendResetEmail.mutate(staffUser.email);
  };

  const handleTestAsStaff = async (staffUser: TeamMemberWithLogin['staffUser']) => {
    if (!staffUser || !staffUser.is_active) {
      toast.error("Cannot impersonate inactive staff user");
      return;
    }

    setImpersonatingUserId(staffUser.id);

    try {
      const { data, error } = await supabase.functions.invoke('admin-impersonate-staff', {
        body: { staff_user_id: staffUser.id }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Impersonation failed');
      }

      const staffUrl = new URL('/staff/login', window.location.origin);
      staffUrl.searchParams.set('impersonate_token', data.session_token);
      
      window.open(staffUrl.toString(), '_blank');
      toast.success(`Opened staff portal as ${staffUser.display_name || staffUser.username}`);
    } catch (err: any) {
      console.error('Impersonation error:', err);
      toast.error(err.message || 'Failed to impersonate staff user');
    } finally {
      setImpersonatingUserId(null);
    }
  };

  const handleLinkOrphan = (orphan: OrphanStaffUser) => {
    setLinkingOrphan(orphan);
    setLinkTeamMemberId("");
    setIsLinkDialogOpen(true);
  };

  const handleLinkOrphanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingOrphan || !linkTeamMemberId) {
      toast.error("Please select a team member");
      return;
    }
    linkOrphan.mutate({ staffUserId: linkingOrphan.id, teamMemberId: linkTeamMemberId });
  };

  const getLoginStatusBadge = (status: TeamMemberWithLogin['loginStatus'], staffUser: TeamMemberWithLogin['staffUser']) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'pending':
        return <Badge variant="secondary">Access Pending</Badge>;
      case 'none':
        return <Badge variant="outline">No Access</Badge>;
    }
  };

  // Filter to show only active team members in main roster
  const activeRoster = roster.filter(m => m.status === 'active');

  return (
    <div className="space-y-6">
      {/* Helper banner */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <UserCog className="h-4 w-4" />
          <span>Team roster is managed in <strong>My Agency → Team</strong></span>
        </div>
        <Link to="/agency/manage?tab=team">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage Team
          </Button>
        </Link>
      </div>

      {/* Main Roster Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Staff Portal Access
              </CardTitle>
              <CardDescription>
                Grant and manage staff portal login access for your team members
              </CardDescription>
            </div>
            <EmailDeliveryNoticeButton />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading team roster...</div>
          ) : activeRoster.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active team members. Add team members in My Agency → Team first.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Staff Login</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeRoster.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{member.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.email || member.staffUser?.email || "—"}
                      </TableCell>
                      <TableCell>
                        {getLoginStatusBadge(member.loginStatus, member.staffUser)}
                      </TableCell>
                      <TableCell>
                        {member.staffUser?.last_login_at
                          ? new Date(member.staffUser.last_login_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {member.loginStatus === 'none' ? (
                          <Button size="sm" onClick={() => handleGrantAccess(member)}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Grant Access
                          </Button>
                        ) : member.loginStatus === 'pending' ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline">
                                <MoreVertical className="h-4 w-4 mr-1" />
                                Pending
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => {
                                if (!member.staffUser) return;
                                setResetStaffUser(member.staffUser);
                                setNewPassword(generateRandomPassword());
                                setShowNewPassword(true);
                                setIsResetDialogOpen(true);
                              }}>
                                <Key className="h-4 w-4 mr-2" />
                                Set Password & Activate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => handleResendInvite(member)}
                                disabled={sendInvite.isPending}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Resend Invite
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onSelect={() => handleTestAsStaff(member.staffUser)}
                                disabled={!member.staffUser?.is_active || impersonatingUserId === member.staffUser?.id}
                              >
                                {impersonatingUserId === member.staffUser?.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Opening...
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Test as Staff
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => handleEditStaffUser(member.staffUser)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Login
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleResetPassword(member.staffUser)}>
                                <Key className="h-4 w-4 mr-2" />
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onSelect={() => handleSendResetEmail(member.staffUser)}
                                disabled={!member.staffUser?.email}
                              >
                                <Mail className="h-4 w-4 mr-2" />
                                Send Password Reset Email
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => member.staffUser && toggleActive.mutate({ userId: member.staffUser.id, isActive: member.staffUser.is_active })}
                              >
                                {member.staffUser?.is_active ? (
                                  <>
                                    <UserX className="h-4 w-4 mr-2" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orphan Staff Users Section */}
      {orphanStaffUsers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Unlinked Staff Accounts
            </CardTitle>
            <CardDescription>
              These staff accounts are not linked to any team member. Link them to enable training metrics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orphanStaffUsers.map((orphan) => (
                    <TableRow key={orphan.id}>
                      <TableCell className="font-mono">{orphan.username}</TableCell>
                      <TableCell>{orphan.display_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{orphan.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={orphan.is_active ? "default" : "secondary"}>
                          {orphan.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => handleLinkOrphan(orphan)}>
                          <Link2 className="h-4 w-4 mr-2" />
                          Link to Team Member
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grant Access Dialog */}
      <Dialog open={grantAccessDialogOpen} onOpenChange={setGrantAccessDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Grant Staff Portal Access</DialogTitle>
            <DialogDescription>
              Create staff portal access for {grantAccessMember?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGrantAccessSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Access Method</Label>
              <Select value={grantAccessMode} onValueChange={(v) => setGrantAccessMode(v as 'invite' | 'password')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invite">Send Invite Email</SelectItem>
                  <SelectItem value="password">Create Password Now</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {grantAccessMode === 'invite' ? (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  An email will be sent to <strong>{grantAccessMember?.email || 'the team member'}</strong> with a link to set up their password.
                </p>
                {!grantAccessMember?.email && (
                  <p className="text-sm text-amber-600 mt-2">
                    ⚠️ No email on file. Add an email in My Agency → Team first, or use "Create Password Now".
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showGrantAccessPassword ? "text" : "password"}
                      value={grantAccessPassword}
                      onChange={(e) => setGrantAccessPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowGrantAccessPassword(!showGrantAccessPassword)}
                    >
                      {showGrantAccessPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button type="button" variant="outline" onClick={handleGeneratePassword}>
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Username will be: {grantAccessMember?.name.toLowerCase().replace(/\s+/g, '.')}
                </p>
              </div>
            )}

            <Button 
              type="submit" 
              disabled={
                (grantAccessMode === 'invite' && !grantAccessMember?.email) ||
                (grantAccessMode === 'password' && grantAccessPassword.length < 8) ||
                sendInvite.isPending ||
                createStaffUserWithPassword.isPending
              }
              className="w-full"
            >
              {sendInvite.isPending || createStaffUserWithPassword.isPending 
                ? "Processing..." 
                : grantAccessMode === 'invite' 
                  ? "Send Invite" 
                  : "Create Access"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Staff User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff Login</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username *</Label>
              <Input
                id="edit-username"
                value={editFormData.username}
                onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-display_name">Display Name</Label>
              <Input
                id="edit-display_name"
                value={editFormData.display_name}
                onChange={(e) => setEditFormData({ ...editFormData, display_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email Address</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={editStaffUser.isPending} className="w-full">
              {editStaffUser.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog (context-aware: activate pending vs reset active) */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resetStaffUser && !resetStaffUser.is_active ? "Set Password & Activate" : "Reset Password"}
            </DialogTitle>
            <DialogDescription>
              {resetStaffUser && !resetStaffUser.is_active
                ? `Set a password to activate ${resetStaffUser?.display_name || resetStaffUser?.username}'s account`
                : `Set a new password for ${resetStaffUser?.display_name || resetStaffUser?.username}`
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button type="button" variant="outline" onClick={handleGenerateNewPassword}>
                  Generate
                </Button>
              </div>
            </div>
            <Button type="submit" disabled={resetPassword.isPending} className="w-full">
              {resetPassword.isPending
                ? "Processing..."
                : resetStaffUser && !resetStaffUser.is_active
                  ? "Set Password & Activate"
                  : "Reset Password"
              }
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Link Orphan Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to Team Member</DialogTitle>
            <DialogDescription>
              Link {linkingOrphan?.display_name || linkingOrphan?.username} to a team member for metrics tracking
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLinkOrphanSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Select Team Member</Label>
              <Select value={linkTeamMemberId} onValueChange={setLinkTeamMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose team member..." />
                </SelectTrigger>
                <SelectContent>
                  {unlinkedTeamMembers.map(tm => (
                    <SelectItem key={tm.id} value={tm.id}>
                      {tm.name} ({tm.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {unlinkedTeamMembers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  All team members already have staff access linked.
                </p>
              )}
            </div>
            <Button 
              type="submit" 
              disabled={linkOrphan.isPending || !linkTeamMemberId} 
              className="w-full"
            >
              {linkOrphan.isPending ? "Linking..." : "Link Team Member"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
