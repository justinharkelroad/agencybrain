import React, { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  Upload,
  Download,
  LogOut,
  TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Agency {
  id: string;
  name: string;
  created_at: string;
}

interface Profile {
  id: string;
  agency_id: string;
  role: string;
  created_at: string;
  agency: Agency;
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
  file_path: string;
  file_size: number;
  created_at: string;
}

const ClientDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { user, isAdmin, signOut } = useAuth();
  const [client, setClient] = useState<Profile | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user && isAdmin && clientId) {
      fetchClientData();
    }
  }, [user, isAdmin, clientId]);

  const fetchClientData = async () => {
    try {
      // Fetch client profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          agency:agencies(*)
        `)
        .eq('id', clientId)
        .single();

      if (profileError) throw profileError;
      setClient(profileData);

      // Fetch client's periods
      const { data: periodsData, error: periodsError } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', profileData.id)
        .order('end_date', { ascending: false });

      if (periodsError) throw periodsError;
      setPeriods(periodsData || []);

      // Fetch client's uploads
      const { data: uploadsData, error: uploadsError } = await supabase
        .from('uploads')
        .select('*')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false });

      if (uploadsError) throw uploadsError;
      setUploads(uploadsData || []);

    } catch (error) {
      console.error('Error fetching client data:', error);
      toast({
        title: "Error",
        description: "Failed to load client data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (filePath: string, originalName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('uploads')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (period: Period) => {
    const hasFormData = period.form_data && Object.keys(period.form_data).length > 0;
    const periodUploads = uploads.filter(u => 
      new Date(u.created_at) >= new Date(period.start_date) &&
      new Date(u.created_at) <= new Date(period.end_date)
    );
    
    if (hasFormData && periodUploads.length > 0) {
      return <Badge variant="default">Complete</Badge>;
    } else if (hasFormData || periodUploads.length > 0) {
      return <Badge variant="secondary">Partial</Badge>;
    } else if (period.status === 'active') {
      return <Badge variant="outline">In Progress</Badge>;
    } else {
      return <Badge variant="destructive">Not Started</Badge>;
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

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Client Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested client could not be found.</p>
          <Link to="/admin">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
        </div>
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
            <Link to="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
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
        {/* Client Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{client.agency?.name}</h1>
              <p className="text-muted-foreground">
                Client since {formatDate(client.created_at)}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Periods</p>
                    <p className="text-2xl font-bold">{periods.length}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Completed Forms</p>
                    <p className="text-2xl font-bold">
                      {periods.filter(p => p.form_data && Object.keys(p.form_data).length > 0).length}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Uploads</p>
                    <p className="text-2xl font-bold">{uploads.length}</p>
                  </div>
                  <Upload className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Detailed Information */}
        <Tabs defaultValue="periods" className="space-y-6">
          <TabsList>
            <TabsTrigger value="periods">Reporting Periods</TabsTrigger>
            <TabsTrigger value="uploads">File Uploads</TabsTrigger>
            <TabsTrigger value="analysis" disabled>AI Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="periods" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Reporting Periods</CardTitle>
                <CardDescription>
                  View all reporting periods and submission status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {periods.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No reporting periods found
                  </p>
                ) : (
                  <div className="space-y-4">
                    {periods.map((period) => (
                      <div
                        key={period.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <h3 className="font-semibold">
                            {formatDate(period.start_date)} - {formatDate(period.end_date)}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Created {formatDate(period.created_at)}
                            {period.form_data && Object.keys(period.form_data).length > 0 && (
                              <span className="ml-2">• Form submitted</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          {getStatusBadge(period)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="uploads" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>File Uploads</CardTitle>
                <CardDescription>
                  All files uploaded by this client
                </CardDescription>
              </CardHeader>
              <CardContent>
                {uploads.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No files uploaded yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {uploads.map((upload) => (
                      <div
                        key={upload.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{upload.original_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatFileSize(upload.file_size)} • 
                              <span className="capitalize ml-1">{upload.category}</span> • 
                              {formatDate(upload.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline" className="capitalize">
                            {upload.category}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadFile(upload.file_path, upload.original_name)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ClientDetail;