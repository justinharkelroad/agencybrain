import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PlusCircle, FileText, Upload, History, LogOut, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

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
  const [currentPeriod, setCurrentPeriod] = useState<Period | null>(null);
  const [allPeriods, setAllPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

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
      // Fetch all periods for current user, ordered by most recently updated
      const { data: periodsData, error: periodsError } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });

      if (periodsError) {
        console.error('Periods error:', periodsError);
        return;
      }

      setAllPeriods(periodsData || []);
      
      // Set current period to the most recently updated one
      const mostRecentPeriod = periodsData?.[0] || null;
      setCurrentPeriod(mostRecentPeriod);
      setSelectedPeriodId(mostRecentPeriod?.id || '');

      // Fetch uploads for current user
      const { data: uploadsData, error: uploadsError } = await supabase
        .from('uploads')
        .select('id, category, original_name')
        .eq('user_id', user?.id);

      if (!uploadsError && uploadsData) {
        setUploads(uploadsData);
      }

      // Calculate comparison data if we have multiple periods
      if (periodsData && periodsData.length >= 2) {
        calculateComparisonData(periodsData);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateComparisonData = (periods: Period[]) => {
    if (periods.length < 2) return;
    
    const current = periods[0];
    const previous = periods[1];
    
    if (!current.form_data || !previous.form_data) return;

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
    if (previous === 0) return { value: 0, percentage: 0, trend: 'neutral' };
    
    const change = current - previous;
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

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const { data, error } = await supabase
        .from('periods')
        .insert({
          user_id: user.id,
          title: `Period ${new Date().toISOString().split('T')[0]}`,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          status: 'active',
          form_data: {}
        })
        .select()
        .single();

      if (error) {
        toast({
          title: "Error",
          description: error.message,
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
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img 
              src="/lovable-uploads/a2a07245-ffb4-4abf-acb8-03c996ab79a1.png" 
              alt="Standard" 
              className="h-8 mr-3"
            />
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2">
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Link to="/submit">
                <Button variant="ghost" size="sm">Submit</Button>
              </Link>
              <Link to="/uploads">
                <Button variant="ghost" size="sm">Uploads</Button>
              </Link>
              <Link to="/file-processor">
                <Button variant="ghost" size="sm">File Processing</Button>
              </Link>
            </nav>
            {isAdmin && (
              <Link to="/admin">
                <Button variant="outline">Admin Panel</Button>
              </Link>
            )}
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
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
              {/* Submit New Data Card */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-3">
                        Submit New Data for Coaching Call
                        {getStatusBadge()}
                      </CardTitle>
                      <CardDescription>
                        Prepare for your next coaching session
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button onClick={createNewPeriod} variant="outline" size="sm">
                        <PlusCircle className="w-4 h-4 mr-2" />
                        New Period
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link to="/submit">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="pt-6">
                          <div className="flex flex-col items-center text-center space-y-2">
                            <FileText className="w-12 h-12 text-primary" />
                            <h3 className="font-semibold">Meeting Form</h3>
                            <p className="text-sm text-muted-foreground">Submit to update Dashboard</p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                    <Link to="/uploads/history">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="pt-6">
                          <div className="flex flex-col items-center text-center space-y-2">
                            <History className="w-12 h-12 text-primary" />
                            <h3 className="font-semibold">History</h3>
                            <p className="text-sm text-muted-foreground">View past periods</p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                </CardContent>
              </Card>

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
                                  {new Date(period.updated_at).toLocaleDateString()} - {period.form_data ? 'Complete' : 'Draft'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                          <p className="text-2xl font-bold">
                            {currentPeriod.form_data.sales.achieveVC ? '✓' : '✗'}
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