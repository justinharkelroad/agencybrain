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
import { Plus, UserCog, Eye, EyeOff, MoreVertical, Edit, Key, UserX, UserCheck } from "lucide-react";

interface StaffUser {
  id: string;
  agency_id: string;
  username: string;
  display_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

// Helper function to generate random password
const generateRandomPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Helper function to copy to clipboard
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Password copied to clipboard");
  } catch (err) {
    toast.error("Failed to copy to clipboard");
  }
};

export default function AdminStaffUsers() {
  const queryClient = useQueryClient();
  
  // Get current user's agency ID
  const { data: profile } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });
  
  const agencyId = profile?.agency_id;

  // Create dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    display_name: "",
  });

  // Edit dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editFormData, setEditFormData] = useState({
    username: "",
    display_name: "",
  });

  // Reset password dialog states
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetUser, setResetUser] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Fetch staff users for agency
  const { data: staffUsers = [], isLoading } = useQuery({
    queryKey: ["staff-users", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      
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

  // Create staff user mutation
  const createStaffUser = useMutation({
    mutationFn: async (userData: typeof formData) => {
      const { data, error } = await supabase.functions.invoke("admin_create_staff_user", {
        body: {
          agency_id: agencyId,
          username: userData.username,
          password: userData.password,
          display_name: userData.display_name || userData.username,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      toast.success("Staff user created successfully");
      setIsCreateDialogOpen(false);
      setFormData({ username: "", password: "", display_name: "" });
      setShowPassword(false);
    },
    onError: (error: any) => {
      console.error("Create staff user error:", error);
      toast.error(error.message || "Failed to create staff user");
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
      console.error("Edit staff user error:", error);
      toast.error(error.message || "Failed to update staff user");
    },
  });

  // Reset password mutation
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
      console.error("Reset password error:", error);
      toast.error(error.message || "Failed to reset password");
    },
  });

  // Toggle active status mutation
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
      console.error("Toggle active error:", error);
      toast.error("Failed to update staff user");
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
    });
    setIsEditDialogOpen(true);
  };

  const handleResetPassword = (user: StaffUser) => {
    setResetUser(user);
    setNewPassword("");
    setShowNewPassword(false);
    setIsResetDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Staff User Management
              </CardTitle>
              <CardDescription>
                Create and manage staff users for training system access
              </CardDescription>
            </div>
            
            {/* Create Staff User Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Staff User
                </Button>
              </DialogTrigger>
              <DialogContent>
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
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleGeneratePassword}
                      >
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono">{user.username}</TableCell>
                    <TableCell>{user.display_name || "-"}</TableCell>
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
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(user)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                            <Key className="h-4 w-4 mr-2" />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              toggleActive.mutate({
                                userId: user.id,
                                isActive: user.is_active,
                              })
                            }
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Staff User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff User</DialogTitle>
            <DialogDescription>
              Update username and display name
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username *</Label>
              <Input
                id="edit-username"
                value={editFormData.username}
                onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                placeholder="staff.username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-display-name">Display Name</Label>
              <Input
                id="edit-display-name"
                value={editFormData.display_name}
                onChange={(e) => setEditFormData({ ...editFormData, display_name: e.target.value })}
                placeholder="John Doe"
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
              Reset password for: <span className="font-mono font-semibold">{resetUser?.username}</span>
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
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateNewPassword}
                >
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
    </div>
  );
}
