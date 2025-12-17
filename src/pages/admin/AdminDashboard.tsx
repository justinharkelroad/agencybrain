import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  FileText,
  Upload,
  TrendingUp,
  Search,
  Bell,
  Eye,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, Navigate } from 'react-router-dom';
import { CreateClientDialog } from '@/components/admin/CreateClientDialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

interface Agency {
  id: string;
  name: string;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  agency_id: string;
  role: string;
  created_at: string;
  agency: Agency;
  mrr?: string | number;
  membership_tier?: string;
  full_name?: string;
  email?: string;
}

interface Period {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  status: string;
  form_data: any;
  created_at: string;
}

interface Upload {
  id: string;
  user_id: string;
  category: string;
  original_name: string;
  created_at: string;
}

const AdminDashboard = () => {
  const { user, isAdmin, signOut } = useAuth();
  const [clients, setClients] = useState<Profile[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Period[]>([]);
  const [recentUploads, setRecentUploads] = useState<Upload[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [loading, setLoading] = useState(true);
const [stats, setStats] = useState({
  totalClients: 0,
  activeSubmissions: 0,
  pendingReviews: 0,
  recentUploads: 0
});
const [coachingRevenue, setCoachingRevenue] = useState<number>(0);
const [isRevenueVisible, setIsRevenueVisible] = useState(false);
const revealTimerRef = useRef<number | null>(null);

// Sets of user IDs for accurate status calculation
const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set());
const [completedUserIds, setCompletedUserIds] = useState<Set<string>>(new Set());
const [uploadUserIds, setUploadUserIds] = useState<Set<string>>(new Set());

// Admin actions state
const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
const [isDeleting, setIsDeleting] = useState(false);

// Edit tier state
const [editingClient, setEditingClient] = useState<Profile | null>(null);
const [newTier, setNewTier] = useState<string>('1:1 Coaching');

// Pagination
const [currentPage, setCurrentPage] = useState(1);
const pageSize = 10;

const revealRevenue = () => {
  if (revealTimerRef.current) {
    window.clearTimeout(revealTimerRef.current);
  }
  setIsRevenueVisible(true);
  revealTimerRef.current = window.setTimeout(() => {
    setIsRevenueVisible(false);
    revealTimerRef.current = null;
  }, 5000);
};

const hideRevenue = () => {
  if (revealTimerRef.current) {
    window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = null;
  }
  setIsRevenueVisible(false);
};

const toggleRevenue = () => {
  if (isRevenueVisible) {
    hideRevenue();
  } else {
    revealRevenue();
  }
};

useEffect(() => {
  return () => {
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
    }
  };
}, []);

const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const { toast } = useToast();

  useEffect(() => {
    if (user && isAdmin) {
      fetchAdminData();
    }
  }, [user, isAdmin]);

  const fetchAdminData = async () => {
    try {
      // Fetch all clients (profiles with agencies)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          *,
          agency:agencies(*),
          membership_tier,
          full_name,
          email
        `)
        .neq('role', 'admin')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;
      setClients((profilesData || []).map(item => ({
        ...item,
        user_id: item.id
      })));

      // Fetch recent submissions (periods)
      const { data: periodsData, error: periodsError } = await supabase
        .from('periods')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (periodsError) throw periodsError;
      setRecentSubmissions(periodsData || []);

      // Fetch recent uploads
      const { data: uploadsData, error: uploadsError } = await supabase
        .from('uploads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (uploadsError) throw uploadsError;
      setRecentUploads(uploadsData || []);

// Build status sets (no limit)
const { data: periodsAllData, error: periodsAllError } = await supabase
  .from('periods')
  .select('user_id, status, form_data');
if (periodsAllError) throw periodsAllError;

const activeSet = new Set<string>((periodsAllData || []).filter((p: any) => p.status === 'active').map((p: any) => p.user_id));
const completedSet = new Set<string>((periodsAllData || []).filter((p: any) => p.form_data && Object.keys(p.form_data).length > 0).map((p: any) => p.user_id));

const { data: uploadsAllData, error: uploadsAllError } = await supabase
  .from('uploads')
  .select('user_id');
if (uploadsAllError) throw uploadsAllError;

const uploadSet = new Set<string>((uploadsAllData || []).map((u: any) => u.user_id));

setActiveUserIds(activeSet);
setCompletedUserIds(completedSet);
setUploadUserIds(uploadSet);

// Calculate totals and stats
const totalMRR = (profilesData || []).reduce((sum: number, p: any) => sum + (p?.mrr ? parseFloat(p.mrr as string) : 0), 0);
const activeSubmissions = periodsData?.filter(p => p.status === 'active').length || 0;
const pendingReviews = periodsData?.filter(p => 
  p.form_data && Object.keys(p.form_data).length > 0 && p.status === 'completed'
).length || 0;

setStats({
  totalClients: profilesData?.length || 0,
  activeSubmissions,
  pendingReviews,
  recentUploads: uploadsData?.length || 0
});
setCoachingRevenue(totalMRR);

    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        title: "Error",
        description: "Failed to load admin dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelectedUser = async () => {
    if (!selectedUserId) return;
    try {
      setIsDeleting(true);
      
      // Ensure we have a fresh session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication session expired. Please refresh the page and try again.');
      }
      
      // Attempt deletion with explicit authorization header
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: selectedUserId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (error) {
        console.error('Edge function error:', error);
        
        // Handle specific error cases
        if (error.message?.includes('session') || error.message?.includes('expired')) {
          throw new Error('Session expired. Please refresh the page and try again.');
        }
        if (error.message?.includes('admin')) {
          throw new Error('Admin privileges required. Please check your account permissions.');
        }
        
        throw error;
      }
      
      toast({ title: 'Account deleted', description: 'The selected account was permanently removed.' });
      setSelectedUserId(null);
      await fetchAdminData();
    } catch (e: any) {
      console.error('Delete failed', e);
      
      let errorMessage = e?.message || 'Unexpected error occurred';
      let errorDescription = '';
      
      // Provide helpful error descriptions
      if (errorMessage.includes('session') || errorMessage.includes('Authentication')) {
        errorDescription = 'Try refreshing the page and logging in again.';
      } else if (errorMessage.includes('admin')) {
        errorDescription = 'Contact your system administrator.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorDescription = 'Check your internet connection and try again.';
      }
      
      toast({ 
        title: 'Delete failed', 
        description: errorDescription || errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateTier = async () => {
    if (!editingClient) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ membership_tier: newTier })
        .eq('id', editingClient.id);

      if (error) throw error;

      toast({
        title: "Tier updated successfully",
        description: `${editingClient.agency?.name || 'Client'} is now on ${newTier}`,
      });

      setEditingClient(null);
      await fetchAdminData();
    } catch (error) {
      console.error('Error updating tier:', error);
      toast({
        title: "Failed to update tier",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

const getSubmissionStatus = (profile: Profile) => {
  const hasActivePeriod = activeUserIds.has(profile.id);
  const hasCompletedSubmission = completedUserIds.has(profile.id);
  const hasUploads = uploadUserIds.has(profile.id);

  if (hasCompletedSubmission && hasUploads) {
    return <Badge variant="default" title="Complete: Form submitted + at least one upload">Complete</Badge>;
  } else if (hasCompletedSubmission || hasUploads) {
    return <Badge variant="secondary" title="Partial: Form submitted OR upload, but not both">Partial</Badge>;
  } else if (hasActivePeriod) {
    return <Badge variant="outline" title="In Progress: Active period started, no submission/upload yet">In Progress</Badge>;
  } else {
    return <Badge variant="destructive" title="Not Started: No activity yet">Not Started</Badge>;
  }
};

  const filteredClients = clients.filter(client => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      client.agency?.name?.toLowerCase().includes(searchLower) ||
      client.full_name?.toLowerCase().includes(searchLower) ||
      client.email?.toLowerCase().includes(searchLower);
    const matchesTier = tierFilter === 'all' || client.membership_tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  // Reset to first page when searching
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSignOut = async () => {
    await signOut();
  };

  if (!user || !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
<div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div>
    <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
    <p className="text-muted-foreground">
      Monitor client submissions and manage the coaching platform
    </p>
  </div>
  <Card
    className="w-full sm:w-auto cursor-pointer hover:bg-accent/5 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/40"
    role="button"
    tabIndex={0}
    aria-label="Reveal coaching revenue"
    onClick={toggleRevenue}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleRevenue();
      }
    }}
  >
    <CardContent className="p-4">
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Coaching Revenue</p>
          <p className="text-2xl font-medium select-none">
            {isRevenueVisible ? formatCurrency(coachingRevenue) : '••••'}
          </p>
          {!isRevenueVisible && (
            <p className="text-xs text-muted-foreground mt-1">Tap to reveal</p>
          )}
        </div>
        <TrendingUp className="h-8 w-8 text-primary" aria-hidden="true" />
      </div>
    </CardContent>
  </Card>
</div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="hover:bg-accent/5 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                  <p className="text-2xl font-medium">{stats.totalClients}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:bg-accent/5 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Submissions</p>
                  <p className="text-2xl font-medium">{stats.activeSubmissions}</p>
                </div>
                <FileText className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:bg-accent/5 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Reviews</p>
                  <p className="text-2xl font-medium">{stats.pendingReviews}</p>
                </div>
                <Bell className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:bg-accent/5 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recent Uploads</p>
                  <p className="text-2xl font-medium">{stats.recentUploads}</p>
                </div>
                <Upload className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Client Management</CardTitle>
                <CardDescription>
                  Monitor client submission status and progress
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                <div className="w-full md:w-48">
                  <Select value={tierFilter} onValueChange={setTierFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Members</SelectItem>
                      <SelectItem value="1:1 Coaching">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-500">1:1 Coaching</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="Boardroom">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-red-500">Boardroom</Badge>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full md:w-64">
                  <Select value={selectedUserId ?? ''} onValueChange={(v) => setSelectedUserId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose account to delete" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.agency?.name || c.full_name || c.email || c.id}
                          {c.full_name && ` (${c.full_name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={!selectedUserId || isDeleting} title="Permanently delete the selected account">
                      <Trash2 className="w-4 h-4 mr-2" />
                      {isDeleting ? 'Deleting…' : 'Delete account'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the selected user's profile and authentication account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteSelectedUser}>
                        Confirm Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <CreateClientDialog onClientCreated={fetchAdminData} />
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search clients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground flex flex-wrap items-center gap-2" aria-label="Status legend">
              <span className="mr-1">Legend:</span>
              <Badge variant="default" title="Form submitted + at least one upload">Complete</Badge>
              <Badge variant="secondary" title="Form submitted OR upload, but not both">Partial</Badge>
              <Badge variant="outline" title="Active period started, no submission/upload yet">In Progress</Badge>
              <Badge variant="destructive" title="No activity yet">Not Started</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredClients.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchTerm ? 'No clients found matching your search.' : 'No clients yet.'}
                </p>
              ) : (
                <>
                  {paginatedClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-4 border border-border/10 rounded-lg hover:bg-accent/5 transition-all duration-200 animate-fade-in"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex items-center gap-3">
                          <div>
                            <h3 className="font-medium">{client.agency?.name}</h3>
                            <p className="text-sm text-foreground/80">
                              {client.full_name || 'No name'} • {client.email || 'No email'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Joined {new Date(client.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {client.membership_tier === '1:1 Coaching' ? (
                            <Badge>1:1</Badge>
                          ) : (
                            <Badge variant="secondary">Boardroom</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {getSubmissionStatus(client)}
                  <div className="flex gap-2">
                    <Link to={`/admin/client/${client.id}`}>
                      <Button variant="flat" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setEditingClient(client);
                        setNewTier(client.membership_tier || '1:1 Coaching');
                      }}
                    >
                      Edit Tier
                    </Button>
                  </div>
                      </div>
                    </div>
                  ))}

                  {totalPages > 1 && (
                    <div className="pt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious href="#" onClick={(e: React.MouseEvent) => { e.preventDefault(); setCurrentPage(Math.max(1, currentPage - 1)); }} />
                          </PaginationItem>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={page}>
                              <PaginationLink href="#" isActive={page === currentPage} onClick={(e: React.MouseEvent) => { e.preventDefault(); setCurrentPage(page); }}>
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext href="#" onClick={(e: React.MouseEvent) => { e.preventDefault(); setCurrentPage(Math.min(totalPages, currentPage + 1)); }} />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentSubmissions.slice(0, 5).map((submission) => {
                  const userProfile = clients.find(c => c.id === submission.user_id);
                  return (
                    <div key={submission.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{userProfile?.agency?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(submission.end_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={submission.status === 'active' ? 'default' : 'secondary'}>
                        {submission.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentUploads.slice(0, 5).map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{upload.original_name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {upload.category} • {new Date(upload.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline">{upload.category}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Edit Tier Dialog */}
        <Dialog open={editingClient !== null} onOpenChange={(open) => !open && setEditingClient(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Membership Tier</DialogTitle>
              <DialogDescription>
                Change the membership tier for {editingClient?.agency?.name || 'this client'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Tier</label>
                <Badge className={editingClient?.membership_tier === 'Boardroom' ? 'bg-red-500' : 'bg-blue-500'}>
                  {editingClient?.membership_tier || '1:1 Coaching'}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">New Tier</label>
                <Select value={newTier} onValueChange={setNewTier}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1 Coaching">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-500">1:1 Coaching</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="Boardroom">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-500">Boardroom</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingClient(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTier}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminDashboard;