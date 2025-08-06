import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PlusCircle, FileText, Upload, History, LogOut, TrendingUp, TrendingDown, Minus, Trash2 } from 'lucide-react';
import { FormViewer } from '@/components/FormViewer';
import { PeriodDeleteDialog } from '@/components/PeriodDeleteDialog';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';

interface Period {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  form_data: any;
  pdf_url: string | null;
  updated_at: string;
  created_at: string;
}

interface Upload {
  id: string;
  category: string;
  original_name: string;
}

export default function Dashboard() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [currentPeriod, setCurrentPeriod] = useState<Period | null>(null);
  const [allPeriods, setAllPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [agencyName, setAgencyName] = useState<string>('');
  const [editableAgencyName, setEditableAgencyName] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  useEffect(() => {
    setEditableAgencyName(agencyName || '');
  }, [agencyName]);

  // Refresh data when returning to dashboard (e.g., from form submission)
  useEffect(() => {
    const handleFocus = () => {
      if (user && document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    };

    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch periods ordered by status priority then by updated_at
      const { data: periods, error: periodsError } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });

      if (periodsError) throw periodsError;

      if (periods && periods.length > 0) {
        setAllPeriods(periods);
        
        // Prioritize periods with status and data:
        // 1. Complete periods with form_data
        // 2. Active periods with form_data  
        // 3. Any period with form_data
        // 4. Most recently updated period
        let currentPeriodToUse = periods[0]; // fallback
        
        const completePeriods = periods.filter(p => 
          p.status === 'complete' && p.form_data && Object.keys(p.form_data).length > 0
        );
        
        const activePeriods = periods.filter(p => 
          p.status === 'active' && p.form_data && Object.keys(p.form_data).length > 0
        );
        
        const periodsWithData = periods.filter(p => 
          p.form_data && Object.keys(p.form_data).length > 0
        );

        if (completePeriods.length > 0) {
          currentPeriodToUse = completePeriods[0];
        } else if (activePeriods.length > 0) {
          currentPeriodToUse = activePeriods[0];
        } else if (periodsWithData.length > 0) {
          currentPeriodToUse = periodsWithData[0];
        }
        
        setCurrentPeriod(currentPeriodToUse);
        setSelectedPeriodId(currentPeriodToUse.id);
      }

      // Fetch uploads for current user
      const { data: uploadsData, error: uploadsError } = await supabase
        .from('uploads')
        .select('id, category, original_name')
        .eq('user_id', user?.id);

      if (uploadsError) throw uploadsError;
      setUploads(uploadsData || []);

      // Fetch agency name
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user?.id)
        .single();

      if (profile?.agency_id) {
        const { data: agency } = await supabase
          .from('agencies')
          .select('name')
          .eq('id', profile.agency_id)
          .single();
        
        if (agency?.name) {
          setAgencyName(agency.name);
        }
      }

      // Calculate comparison data with proper period ordering
      if (periods && periods.length >= 2) {
        calculateComparisonData(periods);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateComparisonData = (periods: Period[]) => {
    if (periods.length < 2) return;
    
    // Sort periods by completion date (end_date) to get proper chronological comparison
    const sortedPeriods = [...periods]
      .filter(p => p.form_data && Object.keys(p.form_data).length > 0)
      .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
    
    if (sortedPeriods.length < 2) {
      // If we only have one period with data, show absolute values
      if (sortedPeriods.length === 1) {
        const current = sortedPeriods[0];
        const comparison: any = {
          premium: { value: current.form_data.sales?.premium || 0, change: 0, percentage: 0, trend: 'neutral' },
          policies: { value: current.form_data.sales?.policies || 0, change: 0, percentage: 0, trend: 'neutral' },
          marketingSpend: { 
            value: current.form_data.marketing?.leadSources?.reduce((sum, source) => sum + (parseFloat(source.spend) || 0), 0) || 0, 
            change: 0, 
            percentage: 0, 
            trend: 'neutral' 
          },
          netProfit: { 
            value: ((parseFloat(current.form_data.cashFlow?.compensation) || 0) - (parseFloat(current.form_data.cashFlow?.expenses) || 0)), 
            change: 0, 
            percentage: 0, 
            trend: 'neutral' 
          }
        };
        setComparisonData(comparison);
      }
      return;
    }

    const current = sortedPeriods[0];
    const previous = sortedPeriods[1];
    const comparison: any = {};
    
    // Sales comparison
    if (current.form_data.sales && previous.form_data.sales) {
      comparison.premium = calculateChange(
        current.form_data.sales.premium || 0,
        previous.form_data.sales.premium || 0
      );
      comparison.policies = calculateChange(
        current.form_data.sales.policies || 0,
        previous.form_data.sales.policies || 0
      );
    }

    // Marketing comparison
    if (current.form_data.marketing && previous.form_data.marketing) {
      const currentSpend = current.form_data.marketing.leadSources?.reduce((sum, source) => sum + (parseFloat(source.spend) || 0), 0) || 0;
      const previousSpend = previous.form_data.marketing.leadSources?.reduce((sum, source) => sum + (parseFloat(source.spend) || 0), 0) || 0;
      comparison.marketingSpend = calculateChange(currentSpend, previousSpend);
    }

    // Cash flow comparison
    if (current.form_data.cashFlow && previous.form_data.cashFlow) {
      const currentNetProfit = (parseFloat(current.form_data.cashFlow.compensation) || 0) - (parseFloat(current.form_data.cashFlow.expenses) || 0);
      const previousNetProfit = (parseFloat(previous.form_data.cashFlow.compensation) || 0) - (parseFloat(previous.form_data.cashFlow.expenses) || 0);
      comparison.netProfit = calculateChange(currentNetProfit, previousNetProfit);
    }

    setComparisonData(comparison);
  };

  const calculateChange = (current: number, previous: number) => {
    const change = current - previous;
    
    if (previous === 0) {
      return { 
        value: current, 
        percentage: current > 0 ? 100 : 0, 
        trend: current > 0 ? 'up' : 'neutral' 
      };
    }
    
    const percentage = (change / previous) * 100;
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    
    return { value: change, percentage, trend };
  };

  const createNewPeriod = async () => {
    try {
      if (!user?.id) {
        toast({
          title: "Error",
          description: "User not found",
          variant: "destructive",
        });
        return;
      }

      // Calculate non-overlapping date range
      let startDate = new Date();
      let endDate = new Date();
      
      // If we have existing periods, start after the most recent period
      if (allPeriods.length > 0) {
        const mostRecentEndDate = Math.max(...allPeriods.map(p => new Date(p.end_date).getTime()));
        startDate = new Date(mostRecentEndDate);
        startDate.setDate(startDate.getDate() + 1); // Start day after most recent period ends
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30); // 30-day period
      } else {
        // First period - use standard 30-day range
        startDate.setDate(startDate.getDate() - 30);
      }

      const { data, error } = await supabase
        .from('periods')
        .insert({
          user_id: user.id,
          title: `Period ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          status: 'draft',
          form_data: null
        })
        .select()
        .single();

      if (error) {
        toast({
          title: "Error",
          description: error.message.includes('periods_user_date_range_unique') 
            ? "A period with these dates already exists. Please use the existing period."
            : error.message,
          variant: "destructive",
        });
      } else {
        setCurrentPeriod(data);
        setAllPeriods([data, ...allPeriods]);
        setSelectedPeriodId(data.id);
        toast({
          title: "Success",
          description: "New reporting period created",
        });
      }
    } catch (error) {
      console.error('Error creating period:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while creating the period.",
        variant: "destructive",
      });
    }
  };

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
    const period = allPeriods.find(p => p.id === periodId);
    if (period) {
      setCurrentPeriod(period);
    }
  };

  const getStatusBadge = () => {
    if (!currentPeriod) return null;
    
    const hasFormData = currentPeriod.form_data && Object.keys(currentPeriod.form_data).length > 0;
    const hasUploads = uploads.length > 0;
    
    if (hasFormData && hasUploads) {
      return <Badge variant="default">Complete</Badge>;
    } else if (hasFormData || hasUploads) {
      return <Badge variant="secondary">Partial</Badge>;
    } else {
      return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleUpdateProfile = async () => {
    if (!user?.id) return;

    try {
      // First, find or create the agency
      const { data: existingAgency, error: searchError } = await supabase
        .from('agencies')
        .select('id')
        .eq('name', editableAgencyName)
        .maybeSingle();

      if (searchError && searchError.code !== 'PGRST116') {
        throw searchError;
      }

      let agencyId = existingAgency?.id;

      if (!agencyId && editableAgencyName.trim()) {
        // Create new agency if it doesn't exist
        const { data: newAgency, error: createError } = await supabase
          .from('agencies')
          .insert({ name: editableAgencyName.trim() })
          .select('id')
          .single();

        if (createError) throw createError;
        agencyId = newAgency.id;
      }

      // Update the profile with the agency_id
      const { error } = await supabase
        .from('profiles')
        .update({ agency_id: agencyId })
        .eq('id', user.id);

      if (error) throw error;

      setAgencyName(editableAgencyName);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

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
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <img 
                src="/lovable-uploads/58ab6d02-1a05-474c-b0c9-58e420b4a692.png" 
                alt="Standard" 
                className="h-8 mr-3"
              />
            </div>
            <div className="flex items-center space-x-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    My Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Account Information</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <Input 
                        value={user?.email || ''} 
                        disabled
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Agency</label>
                      <Input 
                        value={editableAgencyName}
                        onChange={(e) => setEditableAgencyName(e.target.value)}
                        placeholder="Enter agency name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Role</label>
                      <Input 
                        value={isAdmin ? 'Administrator' : 'User'}
                        disabled
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Role is managed by administrators</p>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => setEditableAgencyName(agencyName || '')}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleUpdateProfile}>
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/uploads/select')}
              >
                Upload Files
              </Button>
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="outline" size="sm">
                    Admin Panel
                  </Button>
                </Link>
              )}
              <Button onClick={handleSignOut} variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
            <p className="text-muted-foreground">
              Welcome back! Manage your agency performance reporting here.
            </p>
          </div>

          {!currentPeriod ? (
            <Card>
              <CardHeader>
                <CardTitle>Get Started</CardTitle>
                <CardDescription>
                  Create your first reporting period to begin tracking your agency's performance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={createNewPeriod}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create New Period
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Submit New Data and Agency Name Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle>
                          Submit New Data for Coaching Call
                        </CardTitle>
                        <CardDescription>
                          Submit To Prepare For Your Call
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center">
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-6">
                          <Button 
                            variant="ghost"
                            className="h-auto p-4 w-full"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate('/submit?mode=new');
                            }}
                          >
                            <div className="flex flex-col items-center text-center space-y-2">
                              <FileText className="w-12 h-12 text-primary" />
                              <h3 className="font-semibold">Meeting Form</h3>
                              <p className="text-sm text-muted-foreground">Submit To Prepare For Your Call</p>
                            </div>
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/20">
                  <CardContent className="flex items-center justify-center h-full py-12">
                    <div className="text-center w-full">
                      <h1 className="font-bold text-primary leading-tight" style={{
                        fontSize: `clamp(1.5rem, ${Math.max(1.5, Math.min(4, 20 / Math.max(1, (agencyName || 'HFI INC').length / 3)))}rem, 4rem)`
                      }}>
                        {agencyName || 'HFI INC'}
                      </h1>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Metrics */}
              {Object.keys(currentPeriod.form_data || {}).length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle>Performance Metrics</CardTitle>
                      </div>
                      <div className="flex items-center gap-3">
                         {allPeriods.length > 1 && (
                           <Select value={selectedPeriodId} onValueChange={handlePeriodChange}>
                             <SelectTrigger className="w-48 bg-background">
                               <SelectValue placeholder="Select period" />
                             </SelectTrigger>
                             <SelectContent className="bg-background border shadow-lg z-50">
                               {allPeriods.map((period) => (
                                 <SelectItem key={period.id} value={period.id}>
                                   {new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()} ({period.form_data && Object.keys(period.form_data).length > 0 ? 'Complete' : 'Draft'})
                                 </SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         )}
                         {currentPeriod && (
                           <div className="flex items-center gap-2">
                             <FormViewer 
                               period={currentPeriod}
                               triggerButton={
                                 <Button variant="outline" size="sm">
                                   <FileText className="w-4 h-4 mr-2" />
                                   View Details
                                 </Button>
                               }
                             />
                             <PeriodDeleteDialog
                               period={currentPeriod}
                               onDelete={() => {
                                 fetchDashboardData();
                                 // Reset to first available period or null
                                 const remainingPeriods = allPeriods.filter(p => p.id !== currentPeriod.id);
                                 if (remainingPeriods.length > 0) {
                                   setCurrentPeriod(remainingPeriods[0]);
                                   setSelectedPeriodId(remainingPeriods[0].id);
                                 } else {
                                   setCurrentPeriod(null);
                                   setSelectedPeriodId('');
                                 }
                               }}
                               triggerButton={
                                 <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                   <Trash2 className="w-4 h-4 mr-2" />
                                   Delete Period
                                 </Button>
                               }
                             />
                           </div>
                         )}
                        {currentPeriod?.form_data && (
                          <Link to="/submit">
                            <Button variant="outline" size="sm">
                              Update This Period
                            </Button>
                          </Link>
                        )}
                        {allPeriods.length >= 2 && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <TrendingUp className="w-4 h-4 mr-2" />
                                View Comparison
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Month-over-Month Comparison</DialogTitle>
                              </DialogHeader>
                              <div className="grid grid-cols-2 gap-6 mt-4">
                                {comparisonData?.premium && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">Premium</span>
                                      {getTrendIcon(comparisonData.premium.trend)}
                                    </div>
                                    <p className="text-2xl font-bold">
                                      ${Math.abs(comparisonData.premium.value).toLocaleString()}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {comparisonData.premium.percentage > 0 ? '+' : ''}
                                      {comparisonData.premium.percentage.toFixed(1)}% from last period
                                    </p>
                                  </div>
                                )}
                                {comparisonData?.policies && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">Policies</span>
                                      {getTrendIcon(comparisonData.policies.trend)}
                                    </div>
                                    <p className="text-2xl font-bold">
                                      {Math.abs(comparisonData.policies.value)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {comparisonData.policies.percentage > 0 ? '+' : ''}
                                      {comparisonData.policies.percentage.toFixed(1)}% from last period
                                    </p>
                                  </div>
                                )}
                                {comparisonData?.marketingSpend && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">Marketing Spend</span>
                                      {getTrendIcon(comparisonData.marketingSpend.trend)}
                                    </div>
                                    <p className="text-2xl font-bold">
                                      ${Math.abs(comparisonData.marketingSpend.value).toLocaleString()}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {comparisonData.marketingSpend.percentage > 0 ? '+' : ''}
                                      {comparisonData.marketingSpend.percentage.toFixed(1)}% from last period
                                    </p>
                                  </div>
                                )}
                                {comparisonData?.netProfit && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">Net Profit</span>
                                      {getTrendIcon(comparisonData.netProfit.trend)}
                                    </div>
                                    <p className="text-2xl font-bold">
                                      ${Math.abs(comparisonData.netProfit.value).toLocaleString()}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {comparisonData.netProfit.percentage > 0 ? '+' : ''}
                                      {comparisonData.netProfit.percentage.toFixed(1)}% from last period
                                    </p>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* First Row: Premium Sold, Policies Sold, # Of Policies Quoted, VC Achieved */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {currentPeriod.form_data.sales && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            ${currentPeriod.form_data.sales.premium || '0'}
                          </p>
                          <p className="text-sm text-muted-foreground">Premium Sold</p>
                        </div>
                      )}
                      {currentPeriod.form_data.sales && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            {currentPeriod.form_data.sales.policies || '0'}
                          </p>
                          <p className="text-sm text-muted-foreground">Policies Sold</p>
                        </div>
                      )}
                      {currentPeriod.form_data.marketing && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            {currentPeriod.form_data.marketing.policiesQuoted || '0'}
                          </p>
                          <p className="text-sm text-muted-foreground"># of Policies Quoted</p>
                        </div>
                      )}
                       {currentPeriod.form_data.sales && (
                         <div className="text-center">
                           <p className={`text-2xl font-bold ${
                             currentPeriod.form_data.sales.achievedVC === true || currentPeriod.form_data.sales.achievedVC === 'true' ? 'text-green-600' : 'text-red-600'
                           }`}>
                             {currentPeriod.form_data.sales.achievedVC === true || currentPeriod.form_data.sales.achievedVC === 'true' ? '✓' : '✗'}
                           </p>
                           <p className="text-sm text-muted-foreground">VC Achieved</p>
                         </div>
                       )}
                    </div>

                    {/* Second Row: Total Marketing Spend, Agency Compensation, Expenses, Net Profit */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t">
                      {currentPeriod.form_data.marketing && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            ${(() => {
                              const leadSources = currentPeriod.form_data.marketing.leadSources || [];
                              const totalSpend = leadSources.reduce((sum, source) => sum + (parseFloat(source.spend) || 0), 0);
                              return totalSpend.toLocaleString();
                            })()}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Marketing Spend</p>
                        </div>
                      )}
                      {currentPeriod.form_data.cashFlow && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            ${currentPeriod.form_data.cashFlow.compensation || '0'}
                          </p>
                          <p className="text-sm text-muted-foreground">Agency Compensation</p>
                        </div>
                      )}
                      {currentPeriod.form_data.cashFlow && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            ${currentPeriod.form_data.cashFlow.expenses || '0'}
                          </p>
                          <p className="text-sm text-muted-foreground">Expenses</p>
                        </div>
                      )}
                      {currentPeriod.form_data.cashFlow && (
                        <div className="text-center">
                          <p className={`text-2xl font-bold ${
                            (() => {
                              const compensation = parseFloat(currentPeriod.form_data.cashFlow.compensation || '0');
                              const expenses = parseFloat(currentPeriod.form_data.cashFlow.expenses || '0');
                              const netProfit = compensation - expenses;
                              return netProfit >= 0 ? 'text-green-600' : 'text-red-600';
                            })()
                          }`}>
                            ${(() => {
                              const compensation = parseFloat(currentPeriod.form_data.cashFlow.compensation || '0');
                              const expenses = parseFloat(currentPeriod.form_data.cashFlow.expenses || '0');
                              return (compensation - expenses).toLocaleString();
                            })()}
                          </p>
                          <p className="text-sm text-muted-foreground">Net Profit</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}