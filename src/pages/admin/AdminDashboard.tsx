import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
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
  LogOut 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, Navigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CreateClientDialog } from '@/components/admin/CreateClientDialog';

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
          agency:agencies(*)
        `)
        .neq('role', 'admin')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;
      setClients(profilesData || []);

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

  const filteredClients = clients.filter(client =>
    client.agency?.name.toLowerCase().includes(searchTerm.toLowerCase())
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
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
              <img 
                src="/lovable-uploads/a2a07245-ffb4-4abf-acb8-03c996ab79a1.png" 
                alt="Standard" 
              className="h-8 mr-3"
            />
            <span className="text-lg font-medium text-muted-foreground ml-2">Admin Panel</span>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2">
              <Link to="/admin">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Link to="/admin/analysis">
                <Button variant="ghost" size="sm">Analysis</Button>
              </Link>
              <Link to="/admin/prompts">
                <Button variant="ghost" size="sm">Prompts</Button>
              </Link>
              <Link to="/admin/process-vault-types">
                <Button variant="ghost" size="sm">Process Vault</Button>
              </Link>
            </nav>
            <ThemeToggle />
            <Link to="/dashboard">
              <Button variant="outline" size="sm">Back to App</Button>
            </Link>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
<div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
  <div>
    <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
    <p className="text-muted-foreground">
      Monitor client submissions and manage the coaching platform
    </p>
  </div>
  <Card
    className="gradient-primary shadow-elegant md:w-auto cursor-pointer hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/40"
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
          <p className="text-2xl font-bold select-none">
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
          <Card className="gradient-primary shadow-elegant hover:scale-105 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                  <p className="text-2xl font-bold">{stats.totalClients}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-primary shadow-elegant hover:scale-105 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Submissions</p>
                  <p className="text-2xl font-bold">{stats.activeSubmissions}</p>
                </div>
                <FileText className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-primary shadow-elegant hover:scale-105 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Reviews</p>
                  <p className="text-2xl font-bold">{stats.pendingReviews}</p>
                </div>
                <Bell className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-primary shadow-elegant hover:scale-105 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recent Uploads</p>
                  <p className="text-2xl font-bold">{stats.recentUploads}</p>
                </div>
                <Upload className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client List */}
        <Card className="shadow-elegant">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Client Management</CardTitle>
                <CardDescription>
                  Monitor client submission status and progress
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <CreateClientDialog onClientCreated={fetchAdminData} />
                <div className="relative w-64">
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
                filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-all duration-200 hover:scale-[1.02] animate-fade-in"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{client.agency?.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Joined {new Date(client.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {getSubmissionStatus(client)}
                      <Link to={`/admin/client/${client.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <Card className="shadow-elegant">
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

          <Card className="shadow-elegant">
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
      </main>
    </div>
  );
};

export default AdminDashboard;