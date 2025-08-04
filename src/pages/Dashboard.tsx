import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, FileText, Upload, History, LogOut } from 'lucide-react';
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

export default function Dashboard() {
  const { user, signOut, isAdmin } = useAuth();
  const [currentPeriod, setCurrentPeriod] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchCurrentPeriod();
    }
  }, [user]);

  const fetchCurrentPeriod = async () => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user?.id)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
        return;
      }

      if (profile?.agency_id) {
        const { data, error } = await supabase
          .from('periods')
          .select('*')
          .eq('agency_id', profile.agency_id)
          .eq('status', 'active')
          .maybeSingle();

        if (error) {
          console.error('Periods error:', error);
          return;
        }

        if (data) {
          setCurrentPeriod(data);
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewPeriod = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.agency_id) {
        toast({
          title: "Error",
          description: "No agency found for your account",
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
          agency_id: profile.agency_id,
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
        toast({
          title: "Success",
          description: "New reporting period created",
        });
      }
    } catch (error) {
      console.error('Error creating period:', error);
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
          <h1 className="text-2xl font-bold text-primary">The Standard App</h1>
          <div className="flex items-center gap-4">
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
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Current Period</CardTitle>
                      <CardDescription>
                        {new Date(currentPeriod.start_date).toLocaleDateString()} - {new Date(currentPeriod.end_date).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge variant={currentPeriod.status === 'active' ? 'default' : 'secondary'}>
                      {currentPeriod.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link to="/submit">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-6 text-center">
                          <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
                          <h3 className="font-semibold">Performance Form</h3>
                          <p className="text-sm text-muted-foreground">
                            Submit your metrics
                          </p>
                        </CardContent>
                      </Card>
                    </Link>

                    <Card className="hover:shadow-md transition-shadow cursor-pointer opacity-50">
                      <CardContent className="p-6 text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-primary" />
                        <h3 className="font-semibold">File Uploads</h3>
                        <p className="text-sm text-muted-foreground">
                          Upload supporting documents
                        </p>
                      </CardContent>
                    </Card>

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
                    <CardTitle>Current Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {currentPeriod.form_data.sales && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            ${currentPeriod.form_data.sales.premium?.toLocaleString() || '0'}
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
                            ${currentPeriod.form_data.marketing.totalSpend?.toLocaleString() || '0'}
                          </p>
                          <p className="text-sm text-muted-foreground">Marketing Spend</p>
                        </div>
                      )}
                      {currentPeriod.form_data.cashFlow && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            ${currentPeriod.form_data.cashFlow.netProfit?.toLocaleString() || '0'}
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