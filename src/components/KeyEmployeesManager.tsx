import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Trash2, Mail, Clock, RefreshCw, Loader2, Copy, Users } from "lucide-react";

interface KeyEmployee {
  id: string;
  user_id: string;
  agency_id: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface KeyEmployeeInvite {
  id: string;
  email: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

interface KeyEmployeesManagerProps {
  agencyId: string;
}

export function KeyEmployeesManager({ agencyId }: KeyEmployeesManagerProps) {
  const { user } = useAuth();
  const [keyEmployees, setKeyEmployees] = useState<KeyEmployee[]>([]);
  const [pendingInvites, setPendingInvites] = useState<KeyEmployeeInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [keyEmployeeToRemove, setKeyEmployeeToRemove] = useState<KeyEmployee | null>(null);
  const [inviteToCancel, setInviteToCancel] = useState<KeyEmployeeInvite | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch key employees
      const { data: keData, error: keError } = await supabase
        .from("key_employees")
        .select("*")
        .eq("agency_id", agencyId);

      if (keError) throw keError;

      // Fetch user details for each key employee
      const keyEmployeesWithDetails: KeyEmployee[] = [];
      for (const ke of keData || []) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", ke.user_id)
          .maybeSingle();

        keyEmployeesWithDetails.push({
          ...ke,
          user_email: profile?.email || "Unknown",
          user_name: profile?.full_name || "Unknown",
        });
      }
      setKeyEmployees(keyEmployeesWithDetails);

      // Fetch pending invites
      const { data: invitesData, error: invitesError } = await supabase
        .from("key_employee_invites")
        .select("*")
        .eq("agency_id", agencyId)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (invitesError) throw invitesError;
      setPendingInvites(invitesData || []);
    } catch (error) {
      console.error("Error fetching key employees:", error);
      toast.error("Failed to load key employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (agencyId) {
      fetchData();
    }
  }, [agencyId]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setInviteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite_key_employee", {
        body: { email: inviteEmail.trim() },
      });

      if (error) {
        const errorData = await error.context?.json?.() || {};
        throw new Error(errorData.error || error.message || "Failed to send invite");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Invitation sent successfully");
      setInviteDialogOpen(false);
      setInviteEmail("");
      fetchData();
    } catch (error: any) {
      console.error("Invite error:", error);
      toast.error(error.message || "Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveKeyEmployee = async () => {
    if (!keyEmployeeToRemove) return;

    try {
      const { error } = await supabase
        .from("key_employees")
        .delete()
        .eq("id", keyEmployeeToRemove.id);

      if (error) throw error;

      toast.success("Key employee removed");
      setRemoveDialogOpen(false);
      setKeyEmployeeToRemove(null);
      fetchData();
    } catch (error) {
      console.error("Remove error:", error);
      toast.error("Failed to remove key employee");
    }
  };

  const handleCancelInvite = async () => {
    if (!inviteToCancel) return;

    try {
      const { error } = await supabase
        .from("key_employee_invites")
        .delete()
        .eq("id", inviteToCancel.id);

      if (error) throw error;

      toast.success("Invitation cancelled");
      setCancelDialogOpen(false);
      setInviteToCancel(null);
      fetchData();
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error("Failed to cancel invitation");
    }
  };

  const handleResendInvite = async (invite: KeyEmployeeInvite) => {
    try {
      // Delete old invite and create new one
      await supabase.from("key_employee_invites").delete().eq("id", invite.id);
      
      const { data, error } = await supabase.functions.invoke("invite_key_employee", {
        body: { email: invite.email },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Invitation resent");
      fetchData();
    } catch (error: any) {
      console.error("Resend error:", error);
      toast.error(error.message || "Failed to resend invitation");
    }
  };

  const copyInviteLink = (invite: KeyEmployeeInvite) => {
    // Note: We don't have the token in the invite data from the list query
    // For now, just inform user to resend invite
    toast.info("To copy the invite link, please resend the invitation");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Key Employees
              </CardTitle>
              <CardDescription>
                Key employees have full access to your agency dashboard, just like the agency owner.
              </CardDescription>
            </div>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Key Employee
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {keyEmployees.length === 0 && pendingInvites.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No key employees yet</p>
              <p className="text-sm">Invite someone to give them full access to your agency.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Key Employees */}
              {keyEmployees.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3">Active Key Employees</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keyEmployees.map((ke) => (
                        <TableRow key={ke.id}>
                          <TableCell className="font-medium">{ke.user_name}</TableCell>
                          <TableCell>{ke.user_email}</TableCell>
                          <TableCell>{new Date(ke.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setKeyEmployeeToRemove(ke);
                                setRemoveDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pending Invites */}
              {pendingInvites.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3">Pending Invitations</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="w-[150px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInvites.map((invite) => (
                        <TableRow key={invite.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {invite.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <Clock className="h-3 w-3" />
                              {new Date(invite.expires_at).toLocaleDateString()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleResendInvite(invite)}
                                title="Resend invitation"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  setInviteToCancel(invite);
                                  setCancelDialogOpen(true);
                                }}
                                title="Cancel invitation"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="glass-surface">
          <DialogHeader>
            <DialogTitle>Invite Key Employee</DialogTitle>
            <DialogDescription>
              Enter the email address of the person you want to invite. They'll receive an email with instructions to join your agency.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviteLoading}>
              {inviteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Key Employee Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Key Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{keyEmployeeToRemove?.user_name}</strong> as a key employee? They will lose access to your agency dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setKeyEmployeeToRemove(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveKeyEmployee}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Invite Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation to <strong>{inviteToCancel?.email}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInviteToCancel(null)}>Keep Invitation</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInvite}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
