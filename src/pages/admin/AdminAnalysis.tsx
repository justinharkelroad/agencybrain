import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, 
  Play, 
  FileText, 
  Calendar,
  Loader2,
  ArrowLeft,
  LogOut,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, Navigate } from 'react-router-dom';

interface Agency {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  user_id: string;
  agency_id: string;
  agency: Agency;
}

interface Period {
  id: string;
  agency_id: string;
  start_date: string;
  end_date: string;
  status: string;
  form_data: any;
  agency: Agency;
}

interface Upload {
  id: string;
  user_id: string;
  category: string;
  original_name: string;
  uploaded_at: string;
}

interface Analysis {
  id: string;
  period_id: string;
  prompt_category: string;
  analysis_text: string;
  created_at: string;
  period: Period;
}

interface Prompt {
  id: string;
  category: string;
  prompt_text: string;
  is_active: boolean;
}

const AdminAnalysis = () => {
  const { user, isAdmin, signOut } = useAuth();
  const [clients, setClients] = useState<Profile[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('performance');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const promptCategories = [
    { id: 'performance', label: 'Performance Analysis', description: 'Overall performance review and insights' },
    { id: 'growth', label: 'Growth Opportunities', description: 'Market expansion and growth strategies' },
    { id: 'efficiency', label: 'Operational Efficiency', description: 'Process optimization and cost management' },
    { id: 'retention', label: 'Customer Retention', description: 'Client relationship and retention strategies' },
    { id: 'competitive', label: 'Competitive Analysis', description: 'Market positioning and competitive insights' }
  ];

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (selectedClient) {
      fetchClientPeriods();
      fetchClientUploads();
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchAnalyses();
    }
  }, [selectedPeriod]);

  const fetchData = async () => {
    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('profiles')
        .select(`
          *,
          agency:agencies(*)
        `)
        .neq('role', 'admin')
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // Fetch prompts
      const { data: promptsData, error: promptsError } = await supabase
        .from('prompts')
        .select('*')
        .eq('is_active', true)
        .order('category');

      if (promptsError) throw promptsError;
      setPrompts(promptsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load analysis data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClientPeriods = async () => {
    if (!selectedClient) return;

    try {
      const client = clients.find(c => c.id === selectedClient);
      if (!client) return;

      const { data, error } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', client.id)
        .order('end_date', { ascending: false });

      if (error) throw error;
      setPeriods(data || []);
      setSelectedPeriod('');
    } catch (error) {
      console.error('Error fetching periods:', error);
    }
  };

  const fetchClientUploads = async () => {
    if (!selectedClient) return;

    try {
      const client = clients.find(c => c.id === selectedClient);
      if (!client) return;

      const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .eq('user_id', client.user_id)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setUploads(data || []);
    } catch (error) {
      console.error('Error fetching uploads:', error);
    }
  };

  const fetchAnalyses = async () => {
    if (!selectedPeriod) return;

    try {
      const { data, error } = await supabase
        .from('ai_analysis')
        .select(`
          *,
          period:periods(*)
        `)
        .eq('period_id', selectedPeriod)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnalyses(data || []);
    } catch (error) {
      console.error('Error fetching analyses:', error);
    }
  };

  const runAnalysis = async () => {
    if (!selectedPeriod) {
      toast({
        title: "Error",
        description: "Please select a period to analyze",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const period = periods.find(p => p.id === selectedPeriod);
      const client = clients.find(c => c.id === selectedClient);
      
      if (!period || !client) throw new Error('Invalid selection');

      // Get custom prompt if provided, otherwise use category
      const promptToUse = customPrompt || prompts.find(p => p.category === selectedCategory)?.prompt_text;

      const response = await supabase.functions.invoke('analyze-performance', {
        body: {
          periodData: period.form_data,
          uploads: uploads.filter(u => 
            new Date(u.uploaded_at) >= new Date(period.start_date) &&
            new Date(u.uploaded_at) <= new Date(period.end_date)
          ),
          agencyName: client.agency.name,
          promptCategory: selectedCategory,
          customPrompt: promptToUse
        }
      });

      if (response.error) throw response.error;

      const { analysis } = response.data;

      // Save analysis to database
      const { error: saveError } = await supabase
        .from('ai_analysis')
        .insert({
          period_id: selectedPeriod,
          prompt_category: selectedCategory,
          analysis_text: analysis,
          custom_prompt: customPrompt || null
        });

      if (saveError) throw saveError;

      toast({
        title: "Analysis Complete",
        description: "AI analysis has been generated and saved",
      });

      // Refresh analyses
      fetchAnalyses();
      setCustomPrompt('');

    } catch (error) {
      console.error('Error running analysis:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to generate analysis",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

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

  const selectedClientData = clients.find(c => c.id === selectedClient);
  const selectedPeriodData = periods.find(p => p.id === selectedPeriod);

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
            <span className="text-lg font-medium text-muted-foreground ml-2">AI Analysis</span>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2">
              <Link to="/admin">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Button variant="ghost" size="sm">Analysis</Button>
              <Link to="/admin/prompts">
                <Button variant="ghost" size="sm">Prompts</Button>
              </Link>
            </nav>
            <Link to="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">AI Performance Analysis</h1>
          <p className="text-muted-foreground">
            Generate AI-powered insights for client performance data
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Selection Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Analysis Setup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Client</label>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.agency?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {periods.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Select Period</label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a period" />
                      </SelectTrigger>
                      <SelectContent>
                        {periods.map((period) => (
                          <SelectItem key={period.id} value={period.id}>
                            {new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">Analysis Type</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {promptCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {promptCategories.find(c => c.id === selectedCategory)?.description}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Custom Prompt (Optional)</label>
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Enter a custom analysis prompt or leave blank to use the default..."
                    rows={4}
                  />
                </div>

                <Button 
                  onClick={runAnalysis} 
                  disabled={!selectedPeriod || isAnalyzing}
                  className="w-full"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
                </Button>
              </CardContent>
            </Card>

            {/* Data Summary */}
            {selectedClientData && selectedPeriodData && (
              <Card>
                <CardHeader>
                  <CardTitle>Data Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Agency</p>
                    <p className="text-sm text-muted-foreground">{selectedClientData.agency?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Period</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedPeriodData.start_date).toLocaleDateString()} - {new Date(selectedPeriodData.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Form Data</p>
                    <div className="flex items-center gap-2">
                      {selectedPeriodData.form_data && Object.keys(selectedPeriodData.form_data).length > 0 ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {selectedPeriodData.form_data && Object.keys(selectedPeriodData.form_data).length > 0 
                          ? 'Available' 
                          : 'No data'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Uploads</p>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {uploads.length} files
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
                <CardDescription>
                  AI-generated insights and recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analyses.length === 0 ? (
                  <div className="text-center py-12">
                    <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">No analyses yet</p>
                    <p className="text-sm text-muted-foreground">
                      Select a client and period, then run an analysis to see results here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {analyses.map((analysis) => (
                      <div key={analysis.id} className="border rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="capitalize">
                              {analysis.prompt_category}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(analysis.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                            {analysis.analysis_text}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminAnalysis;