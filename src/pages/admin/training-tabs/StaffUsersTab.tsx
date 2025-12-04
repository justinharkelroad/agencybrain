import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserCog, Eye, EyeOff, MoreVertical, Edit, Key, UserX, UserCheck, Mail, Link2, AlertTriangle } from "lucide-react";

interface StaffUser {
  id: string;
  agency_id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  team_member_id: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string | null;
}

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

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    display_name: "",
    email: "",
  });
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string>("");
  const [newTeamMemberRole, setNewTeamMemberRole] = useState<string>("Sales");

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editFormData, setEditFormData] = useState({
    username: "",
    display_name: "",
    email: "",
  });

  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetUser, setResetUser] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkingUser, setLinkingUser] = useState<StaffUser | null>(null);
  const [linkTeamMemberId, setLinkTeamMemberId] = useState<string>("");
  const [linkCreateNew, setLinkCreateNew] = useState(false);
  const [linkNewTeamMemberRole, setLinkNewTeamMemberRole] = useState<string>("Sales");

  // Fetch staff users with team member info
  const { data: staffUsers = [], isLoading } = useQuery({
    queryKey: ["staff-users", agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_users")
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as StaffUser[];
    },
    enabled: !!agencyId,
  });

  // Fetch all team members for this agency
  const { data: allTeamMembers = [] } = useQuery({
    queryKey: ["team-members", agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, role, email")
        .eq("agency_id", agencyId)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!agencyId,
  });

  // Build a map of team_member_id -> team_member for quick lookup
  const teamMemberMap = new Map(allTeamMembers.map(tm => [tm.id, tm]));

  // Get linked team member IDs
  const linkedTeamMemberIds = new Set(
    staffUsers.filter(u => u.team_member_id).map(u => u.team_member_id)
  );

  // Get unlinked team members (available for linking)
  const unlinkedTeamMembers = allTeamMembers.filter(tm => !linkedTeamMemberIds.has(tm.id));

  const createStaffUser = useMutation({
    mutationFn: async (userData: typeof formData) => {
      const body: Record<string, any> = {
        agency_id: agencyId,
        username: userData.username,
        password: userData.password,
        display_name: userData.display_name || userData.username,
        email: userData.email || null,
      };

      // Handle team member selection
      if (selectedTeamMemberId === "new") {
        body.create_team_member = {
          name: userData.display_name || userData.username,
          role: newTeamMemberRole,
          email: userData.email || null,
        };
      } else if (selectedTeamMemberId && selectedTeamMemberId !== "none") {
        body.team_member_id = selectedTeamMemberId;
      }

      const { data, error } = await supabase.functions.invoke("admin_create_staff_user", {
        body,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Staff user created successfully");
      setIsCreateDialogOpen(false);
      setFormData({ username: "", password: "", display_name: "", email: "" });
      setSelectedTeamMemberId("");
      setNewTeamMemberRole("Sales");
      setShowPassword(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create staff user");
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      toast.success("Staff user updated successfully");
      setIsEditDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update staff user");
    },
  });

  const resetPassword = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data, error } = await supabase.functions.invoke("admin_reset_staff_password", {
        body: {
          user_id: userId,
          new_password: password,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Password reset successfully");
      setIsResetDialogOpen(false);
      setResetUser(null);
      setNewPassword("");
      setShowNewPassword(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reset password");
    },
  });

  const sendResetEmail = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("staff_request_password_reset", {
        body: { email },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Password reset email sent successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send reset email");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("staff_users")
        .update({ is_active: !isActive })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      toast.success("Staff user status updated");
    },
    onError: (error: any) => {
      toast.error("Failed to update staff user");
    },
  });

  const linkTeamMember = useMutation({
    mutationFn: async ({ staffUserId, teamMemberId }: { staffUserId: string; teamMemberId: string }) => {
      const { data, error } = await supabase.functions.invoke("admin_link_staff_team_member", {
        body: {
          staff_user_id: staffUserId,
          team_member_id: teamMemberId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Staff user linked to team member");
      setIsLinkDialogOpen(false);
      setLinkingUser(null);
      setLinkTeamMemberId("");
      setLinkCreateNew(false);
      setLinkNewTeamMemberRole("Sales");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to link staff user");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      toast.error("Username and password are required");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    createStaffUser.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingUser || !editFormData.username) {
      toast.error("Username is required");
      return;
    }

    editStaffUser.mutate({
      userId: editingUser.id,
      userData: editFormData,
    });
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetUser || !newPassword) {
      toast.error("Password is required");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    resetPassword.mutate({
      userId: resetUser.id,
      password: newPassword,
    });
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!linkingUser) return;
    
    let teamMemberIdToLink = linkTeamMemberId;
    
    // If creating new team member
    if (linkCreateNew) {
      const { data: newTm, error: createError } = await supabase
        .from('team_members')
        .insert({
          agency_id: agencyId,
          name: linkingUser.display_name || linkingUser.username,
          role: linkNewTeamMemberRole,
          email: linkingUser.email || `${linkingUser.username.toLowerCase().replace(/\s+/g, '_')}@staff.placeholder`,
          status: 'active',
          employment: 'Full-time'
        })
        .select('id')
        .single();
      
      if (createError) {
        toast.error('Failed to create team member');
        return;
      }
      teamMemberIdToLink = newTm.id;
    }
    
    if (!teamMemberIdToLink) {
      toast.error("Please select or create a team member");
      return;
    }

    linkTeamMember.mutate({
      staffUserId: linkingUser.id,
      teamMemberId: teamMemberIdToLink,
    });
  };

  const handleGeneratePassword = () => {
    const password = generateRandomPassword();
    setFormData({ ...formData, password });
    setShowPassword(true);
    copyToClipboard(password);
  };

  const handleGenerateNewPassword = () => {
    const password = generateRandomPassword();
    setNewPassword(password);
    setShowNewPassword(true);
    copyToClipboard(password);
  };

  const handleEdit = (user: StaffUser) => {
    setEditingUser(user);
    setEditFormData({
      username: user.username,
      display_name: user.display_name || "",
      email: user.email || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSendResetEmail = (user: StaffUser) => {
    if (!user.email) {
      toast.error("No email address for this user");
      return;
    }
    sendResetEmail.mutate(user.email);
  };

  const handleResetPassword = (user: StaffUser) => {
    setResetUser(user);
    setNewPassword("");
    setShowNewPassword(false);
    setIsResetDialogOpen(true);
  };

  const handleLinkTeamMember = (user: StaffUser) => {
    setLinkingUser(user);
    setLinkTeamMemberId("");
    setLinkCreateNew(false);
    setLinkNewTeamMemberRole("Sales");
    setIsLinkDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Staff User Management
              </CardTitle>
              <CardDescription>
                Create and manage staff users for training system access
              </CardDescription>
            </div>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Staff User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Staff User</DialogTitle>
                  <DialogDescription>
                    Create a new staff user account for training system access
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="staff.username"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button type="button" variant="outline" onClick={handleGeneratePassword}>
                        Generate
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Display Name</Label>
                    <Input
                      id="display_name"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="staff@agency.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for password reset emails
                    </p>
                  </div>

                  {/* Team Member Selection */}
                  <div className="space-y-2 border-t pt-4">
                    <Label>Team Member (for metrics)</Label>
                    <Select value={selectedTeamMemberId} onValueChange={setSelectedTeamMemberId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select or create team member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No team member link</SelectItem>
                        <SelectItem value="new">+ Create New Team Member</SelectItem>
                        {unlinkedTeamMembers.map(tm => (
                          <SelectItem key={tm.id} value={tm.id}>
                            {tm.name} ({tm.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Link to a team member for metrics tracking
                    </p>
                  </div>

                  {/* New Team Member Role (shown only when creating new) */}
                  {selectedTeamMemberId === "new" && (
                    <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                      <Label>New Team Member Role</Label>
                      <Select value={newTeamMemberRole} onValueChange={setNewTeamMemberRole}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sales">Sales</SelectItem>
                          <SelectItem value="Service">Service</SelectItem>
                          <SelectItem value="Manager">Manager</SelectItem>
                          <SelectItem value="Hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Uses display name and email from above
                      </p>
                    </div>
                  )}

                  <Button type="submit" disabled={createStaffUser.isPending} className="w-full">
                    {createStaffUser.isPending ? "Creating..." : "Create Staff User"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading staff users...</div>
          ) : staffUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No staff users yet. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Team Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffUsers.map((user) => {
                    const linkedTeamMember = user.team_member_id 
                      ? teamMemberMap.get(user.team_member_id)
                      : null;

                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono">{user.username}</TableCell>
                        <TableCell>{user.display_name || "-"}</TableCell>
                        <TableCell>
                          {linkedTeamMember ? (
                            <span className="text-sm">{linkedTeamMember.name}</span>
                          ) : (
                            <div className="flex items-center gap-1 text-amber-600">
                              <AlertTriangle className="h-3 w-3" />
                              <span className="text-xs">Not Linked</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {linkedTeamMember ? (
                            <Badge variant="outline">{linkedTeamMember.role}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? "default" : "secondary"}>
                            {user.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.last_login_at
                            ? new Date(user.last_login_at).toLocaleDateString()
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => handleEdit(user)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {!user.team_member_id && (
                                <DropdownMenuItem onSelect={() => handleLinkTeamMember(user)}>
                                  <Link2 className="h-4 w-4 mr-2" />
                                  Link Team Member
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onSelect={() => handleResetPassword(user)}>
                                <Key className="h-4 w-4 mr-2" />
                                Reset Password (Manual)
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onSelect={() => handleSendResetEmail(user)}
                                disabled={!user.email}
                              >
                                <Mail className="h-4 w-4 mr-2" />
                                Send Password Reset Email
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => toggleActive.mutate({ userId: user.id, isActive: user.is_active })}
                              >
                                {user.is_active ? (
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff User</DialogTitle>
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

      {/* Reset Password Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetUser?.display_name || resetUser?.username}
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
              {resetPassword.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Link Team Member Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Team Member</DialogTitle>
            <DialogDescription>
              Link {linkingUser?.display_name || linkingUser?.username} to a team member for metrics tracking
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLinkSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Select Team Member</Label>
              <Select 
                value={linkCreateNew ? 'new' : linkTeamMemberId} 
                onValueChange={(value) => {
                  if (value === 'new') {
                    setLinkCreateNew(true);
                    setLinkTeamMemberId('');
                  } else {
                    setLinkCreateNew(false);
                    setLinkTeamMemberId(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose team member..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">+ Create New Team Member</SelectItem>
                  {unlinkedTeamMembers.map(tm => (
                    <SelectItem key={tm.id} value={tm.id}>
                      {tm.name} ({tm.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {linkCreateNew && (
              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                <Label>New Team Member Role</Label>
                <Select value={linkNewTeamMemberRole} onValueChange={setLinkNewTeamMemberRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Service">Service</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Will create team member with name: {linkingUser?.display_name || linkingUser?.username}
                </p>
              </div>
            )}
            
            <Button 
              type="submit" 
              disabled={linkTeamMember.isPending || (!linkCreateNew && !linkTeamMemberId)} 
              className="w-full"
            >
              {linkTeamMember.isPending ? "Linking..." : linkCreateNew ? "Create & Link Team Member" : "Link Team Member"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
