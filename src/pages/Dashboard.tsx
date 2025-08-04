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

  const fetchDashboardData = async () => {
    try {
      // Fetch all periods for current user
      const { data: periodsData, error: periodsError } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', user?.id)
        .order('end_date', { ascending: false });

      if (periodsError) {
        console.error('Periods error:', periodsError);
        return;
      }

      setAllPeriods(periodsData || []);
      
      // Set current period (most recent active one)
      const activePeriod = periodsData?.find(p => p.status === 'active');
      const mostRecentPeriod = periodsData?.[0] || null;
      const current = activePeriod || mostRecentPeriod;
      
      setCurrentPeriod(current);
      setSelectedPeriodId(current?.id || '');

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
      comparison.marketingSpend = calculateChange(
        current.form_data.marketing.totalSpend || 0,
        previous.form_data.marketing.totalSpend || 0
      );
    }

    // Cash flow comparison
    if (current.form_data.cashFlow && previous.form_data.cashFlow) {
      comparison.netProfit = calculateChange(
        current.form_data.cashFlow.netProfit || 0,
        previous.form_data.cashFlow.netProfit || 0
      );
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
              {/* Period Selection and Status */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-3">
                        Current Period
                        {getStatusBadge()}
                      </CardTitle>
                      <CardDescription>
                        {currentPeriod && (
                          <>
                            {new Date(currentPeriod.start_date).toLocaleDateString()} - {new Date(currentPeriod.end_date).toLocaleDateString()}
                          </>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      {allPeriods.length > 1 && (
                        <Select value={selectedPeriodId} onValueChange={handlePeriodChange}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                          <SelectContent>
                            {allPeriods.map((period) => (
                              <SelectItem key={period.id} value={period.id}>
                                {new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button onClick={createNewPeriod} variant="outline" size="sm">
                        <PlusCircle className="w-4 h-4 mr-2" />
                        New Period
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link to="/submit">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-6 text-center">
                          <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
                          <h3 className="font-semibold">Meeting Form</h3>
                          <p className="text-sm text-muted-foreground">
                            Submit to update Dashboard
                          </p>
                        </CardContent>
                      </Card>
                    </Link>

                    <Link to="/uploads">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-6 text-center">
                          <Upload className="w-8 h-8 mx-auto mb-2 text-primary" />
                          <h3 className="font-semibold flex items-center justify-center gap-2">
                            File Uploads
                            <Badge variant="outline" className="text-xs">
                              {uploads.length}
                            </Badge>
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Upload supporting documents
                          </p>
                        </CardContent>
                      </Card>
                    </Link>

                    <Card className="hover:shadow-md transition-shadow cursor-pointer opacity-50">
                      <CardContent className="p-6 text-center">
                        <History className="w-8 h-8 mx-auto mb-2 text-primary" />
                        <h3 className="font-semibold">History</h3>
                        <p className="text-sm text-muted-foreground">
                          View past periods
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              {Object.keys(currentPeriod.form_data || {}).length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Performance Metrics</CardTitle>
                      {comparisonData && (
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
                              {comparisonData.premium && (
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
                              {comparisonData.policies && (
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
                              {comparisonData.marketingSpend && (
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
                              {comparisonData.netProfit && (
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
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {currentPeriod.form_data.sales && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            ${currentPeriod.form_data.sales.premium || '0'}
                          </p>
                          <p className="text-sm text-muted-foreground">Premium</p>
                        </div>
                      )}
                      {currentPeriod.form_data.sales && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            {currentPeriod.form_data.sales.policies || '0'}
                          </p>
                          <p className="text-sm text-muted-foreground">Policies</p>
                        </div>
                      )}
                      {currentPeriod.form_data.marketing && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            ${currentPeriod.form_data.marketing.totalSpend || '0'}
                          </p>
                          <p className="text-sm text-muted-foreground">Marketing Spend</p>
                        </div>
                      )}
                       {currentPeriod.form_data.cashFlow && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            ${(() => {
                              const compensation = parseFloat(currentPeriod.form_data.cashFlow.compensation || '0');
                              const expenses = parseFloat(currentPeriod.form_data.cashFlow.expenses || '0');
                              return compensation - expenses;
                            })()}
                          </p>
                          <p className="text-sm text-muted-foreground">Net Profit</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Additional metrics from form data */}
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-6 border-t">
                      {currentPeriod.form_data.marketing?.policiesQuoted && (
                        <div className="text-center">
                          <p className="text-xl font-bold text-primary">
                            {currentPeriod.form_data.marketing.policiesQuoted}
                          </p>
                          <p className="text-sm text-muted-foreground"># of Policies Quoted</p>
                        </div>
                      )}
                      {currentPeriod.form_data.bonusOps?.currentALR && (
                        <div className="text-center">
                          <p className="text-xl font-bold text-primary">
                            {currentPeriod.form_data.bonusOps.currentALR}
                          </p>
                          <p className="text-sm text-muted-foreground">Current ALR Total YTD</p>
                        </div>
                      )}
                      {currentPeriod.form_data.bonusOps?.aapProjection && (
                        <div className="text-center">
                          <p className="text-xl font-bold text-primary">
                            {currentPeriod.form_data.bonusOps.aapProjection}
                          </p>
                          <p className="text-sm text-muted-foreground">Current AAP Projection</p>
                        </div>
                      )}
                      {currentPeriod.form_data.bonusOps?.bonusTrend && (
                        <div className="text-center">
                          <p className="text-xl font-bold text-primary">
                            {currentPeriod.form_data.bonusOps.bonusTrend}
                          </p>
                          <p className="text-sm text-muted-foreground">Current Bonus Trend #</p>
                        </div>
                      )}
                      {currentPeriod.form_data.retention?.currentRetention && (
                        <div className="text-center">
                          <p className="text-xl font-bold text-primary">
                            {currentPeriod.form_data.retention.currentRetention}%
                          </p>
                          <p className="text-sm text-muted-foreground">Current Retention %</p>
                        </div>
                      )}
                      {currentPeriod.form_data.retention?.terminated && (
                        <div className="text-center">
                          <p className="text-xl font-bold text-primary">
                            {currentPeriod.form_data.retention.terminated}
                          </p>
                          <p className="text-sm text-muted-foreground">Policies Terminated</p>
                        </div>
                      )}
                      {currentPeriod.form_data.cashFlow?.compensation && (
                        <div className="text-center">
                          <p className="text-xl font-bold text-primary">
                            ${currentPeriod.form_data.cashFlow.compensation}
                          </p>
                          <p className="text-sm text-muted-foreground">Compensation</p>
                        </div>
                      )}
                      {currentPeriod.form_data.cashFlow?.expenses && (
                        <div className="text-center">
                          <p className="text-xl font-bold text-primary">
                            ${currentPeriod.form_data.cashFlow.expenses}
                          </p>
                          <p className="text-sm text-muted-foreground">Expenses</p>
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