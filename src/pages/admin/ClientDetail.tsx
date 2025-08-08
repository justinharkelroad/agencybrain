import React, { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  Upload,
  Download,
  LogOut,
  TrendingUp,
  Trash2,
  Save,
  Share2,
  MessageCircle,
  Send
} from 'lucide-react';
import { FormViewer } from '@/components/FormViewer';
import { PeriodDeleteDialog } from '@/components/PeriodDeleteDialog';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

interface Analysis {
  id: string;
  period_id: string | null;
  analysis_type: string;
  analysis_result: string;
  prompt_used: string;
  shared_with_client: boolean;
  selected_uploads: any[];
  created_at: string;
  period?: Period;
}

interface Prompt {
  id: string;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
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
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
const { toast } = useToast();

  // Admin transcript upload/query state
  const [transcriptUploading, setTranscriptUploading] = useState(false);
  const [transcriptQueryPrompt, setTranscriptQueryPrompt] = useState('');
  const [selectedTranscriptIds, setSelectedTranscriptIds] = useState<string[]>([]);
  const [querying, setQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState<string>('');

// File query state
const [promptOptions, setPromptOptions] = useState<Prompt[]>([]);
const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
const [selectedPromptId, setSelectedPromptId] = useState<string>('manual');
const [manualPrompt, setManualPrompt] = useState<string>('');

// Client MRR state
const [mrrValue, setMrrValue] = useState<string>('');
const [savingMRR, setSavingMRR] = useState<boolean>(false);

// Conversation state per analysis
const [conversations, setConversations] = useState<{[analysisId: string]: Array<{role: 'user' | 'assistant', content: string}>}>({});
const [newMessages, setNewMessages] = useState<{[analysisId: string]: string}>({});
const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  // Auto-select all transcripts when uploads change
  useEffect(() => {
    const transcripts = uploads.filter(u => u.category === 'transcripts');
    setSelectedTranscriptIds(transcripts.map(u => u.id));
  }, [uploads]);

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
setMrrValue(profileData?.mrr != null ? String(profileData.mrr) : '');

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

      // Fetch client's analyses
      const { data: analysesData, error: analysesError } = await supabase
        .from('ai_analysis')
        .select(`
          *,
          period:periods(*)
        `)
        .order('created_at', { ascending: false });

      if (analysesError) throw analysesError;
      
      // Filter analyses to only include those for this client
      const clientAnalyses = analysesData?.filter(analysis => {
        // Include if linked to a period owned by this client
        if (analysis.period?.user_id === profileData.id) return true;
        
        // Include file-only analyses that contain files from this client
        if (analysis.period_id === null && analysis.selected_uploads) {
          return analysis.selected_uploads.some((upload: any) => 
            uploadsData?.some(u => u.id === upload.id)
          );
        }
        
        return false;
      }) || [];
      
      setAnalyses(clientAnalyses);

      // Fetch active prompts for dropdown
      const { data: promptsData } = await supabase
        .from('prompts')
        .select('*')
        .eq('is_active', true)
        .order('category');
      setPromptOptions(promptsData || []);

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

const handleSaveMRR = async () => {
  if (!clientId) return;
  const value = parseFloat(mrrValue || '');
  if (isNaN(value) || value < 0) {
    toast({ title: 'Invalid amount', description: 'Please enter a valid MRR amount.', variant: 'destructive' });
    return;
  }
  setSavingMRR(true);
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ mrr: value })
      .eq('id', clientId);
    if (error) throw error;
    setClient((prev) => (prev ? { ...prev, mrr: value } as Profile : prev));
    toast({ title: 'MRR saved', description: 'Monthly recurring revenue updated for this client.' });
  } catch (err: any) {
    console.error('Save MRR failed', err);
    toast({ title: 'Save failed', description: err?.message || 'Please try again.', variant: 'destructive' });
  } finally {
    setSavingMRR(false);
  }
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

  // Admin: upload transcripts for this client
  const handleTranscriptUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !clientId) return;
    setTranscriptUploading(true);
    try {
      const files = await Promise.all(Array.from(fileList).map(async (file) => {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        return { name: file.name, type: file.type, size: file.size, data: base64 };
      }));

      const { data, error } = await supabase.functions.invoke('admin-upload-transcripts', {
        body: { clientId, files, category: 'transcripts' }
      });

      if (error) throw error;

      // Refresh uploads
      await fetchClientData();
      toast({ title: 'Transcripts uploaded', description: 'Your files were uploaded for this client.' });
    } catch (err: any) {
      console.error('Transcript upload failed', err);
      toast({ title: 'Upload failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setTranscriptUploading(false);
    }
  };

  const toggleTranscriptSelection = (id: string) => {
    setSelectedTranscriptIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllTranscripts = () => {
    const all = uploads.filter(u => u.category === 'transcripts').map(u => u.id);
    setSelectedTranscriptIds(all);
  };

  const clearTranscriptSelection = () => setSelectedTranscriptIds([]);

  // File selection helpers
  const toggleFileSelection = (id: string) => {
    setSelectedFileIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selectAllFiles = () => setSelectedFileIds(uploads.map(u => u.id));
  const clearFileSelection = () => setSelectedFileIds([]);

  // Run generic file query (any upload types)
  const runFileQuery = async () => {
    if (!clientId) return;
    const promptText = selectedPromptId === 'manual'
      ? manualPrompt.trim()
      : (promptOptions.find(p => p.id === selectedPromptId)?.content || '').trim();
    if (!promptText || selectedFileIds.length === 0) return;
    setQuerying(true);
    setQueryResult('');
    try {
      const filePaths = uploads
        .filter(u => selectedFileIds.includes(u.id))
        .map(u => u.file_path);

      const { data, error } = await supabase.functions.invoke('query-transcripts', {
        body: { clientId, prompt: promptText, filePaths }
      });
      if (error) throw error;
      if (data?.analysis) setQueryResult(data.analysis);
      await fetchClientData();
      toast({ title: 'Analysis complete', description: 'Saved to AI Analysis.' });
    } catch (err: any) {
      console.error('Query files failed', err);
      toast({ title: 'Query failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setQuerying(false);
    }
  };

  const runTranscriptQuery = async () => {
    if (!clientId || !transcriptQueryPrompt.trim()) return;
    setQuerying(true);
    setQueryResult('');
    try {
      const filePaths = uploads
        .filter(u => selectedTranscriptIds.includes(u.id))
        .map(u => u.file_path);

      const { data, error } = await supabase.functions.invoke('query-transcripts', {
        body: { clientId, prompt: transcriptQueryPrompt, filePaths }
      });
      if (error) throw error;
      if (data?.analysis) setQueryResult(data.analysis);
      // Refresh analyses list
      await fetchClientData();
    } catch (err: any) {
      console.error('Query transcripts failed', err);
      toast({ title: 'Query failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setQuerying(false);
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
            </nav>
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
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">MRR</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={mrrValue}
                      onChange={(e) => setMrrValue(e.target.value)}
                    />
                    <Button onClick={handleSaveMRR} disabled={savingMRR}>
                      <Save className="w-4 h-4 mr-2" />
                      {savingMRR ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                  {client?.mrr != null && (
                    <p className="text-xs text-muted-foreground">
                      Current: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(client.mrr))}
                    </p>
                  )}
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
            <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
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
                          <FormViewer 
                            period={period}
                            triggerButton={
                              <Button variant="outline" size="sm">
                                <FileText className="w-4 h-4 mr-2" />
                                View Form
                              </Button>
                            }
                          />
                          <PeriodDeleteDialog
                            period={period}
                            onDelete={fetchClientData}
                            isAdmin={true}
                            triggerButton={
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

            <TabsContent value="uploads" className="space-y-4">
              {/* Admin: Upload Transcripts for this client */}
              <Card>
                <CardHeader>
                  <CardTitle>Upload Transcripts (Admin)</CardTitle>
                  <CardDescription>
                    Add transcript files for this client. Supported: .txt, .md, .srt, .vtt, .pdf
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <Input
                      type="file"
                      multiple
                      accept=".txt,.md,.srt,.vtt,.pdf"
                      disabled={transcriptUploading}
                      onChange={(e) => handleTranscriptUpload(e.target.files)}
                      aria-label="Upload transcript files"
                    />
                    <Button onClick={() => {}} disabled className="hidden"></Button>
                    <p className="text-xs text-muted-foreground">Files upload directly to this client's library.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Existing uploads list */}
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

          <TabsContent value="analysis" className="space-y-4">
            {/* Query transcripts */}
            <Card>
              <CardHeader>
                <CardTitle>Query Files</CardTitle>
                <CardDescription>
                  Select files, choose a prompt, and run your query. Results are saved below.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {uploads.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No files yet. Upload some on the File Uploads tab.</p>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">Select files</h4>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={selectAllFiles}>Select all</Button>
                          <Button variant="outline" size="sm" onClick={clearFileSelection}>Clear</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto p-2 border rounded-md">
                        {uploads.map((f) => (
                          <label key={f.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedFileIds.includes(f.id)}
                              onChange={() => toggleFileSelection(f.id)}
                            />
                            <span className="truncate">{f.original_name}</span>
                            <span className="text-xs text-muted-foreground">• {f.category} • {formatDate(f.created_at)}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Prompt</label>
                      <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a prompt" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual prompt</SelectItem>
                          {promptOptions.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.title} • {p.category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Manage reusable prompts in the Prompt Library.
                        <Link to="/admin/prompts" className="underline ml-1">Open Prompt Library</Link>
                      </p>
                    </div>

                    {selectedPromptId === 'manual' ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Your prompt</label>
                        <Textarea
                          placeholder="Type your prompt..."
                          value={manualPrompt}
                          onChange={(e) => setManualPrompt(e.target.value)}
                          rows={5}
                        />
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/20">
                        {promptOptions.find(p => p.id === selectedPromptId)?.content}
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Button onClick={runFileQuery} disabled={querying || selectedFileIds.length === 0 || (selectedPromptId === 'manual' && !manualPrompt.trim())}>
                        {querying ? 'Running...' : 'Run Query'}
                      </Button>
                      <p className="text-xs text-muted-foreground">Results are saved to AI Analysis below.</p>
                    </div>

                    {queryResult && (
                      <div className="border rounded-md p-4 bg-muted/20">
                        <h4 className="text-sm font-medium mb-2">Latest Result</h4>
                        <div className="whitespace-pre-wrap text-sm">{queryResult}</div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Existing analyses */}
            <Card>
              <CardHeader>
                <CardTitle>AI Analysis</CardTitle>
                <CardDescription>
                  All AI-generated analyses for this client
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analyses.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No analyses generated yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {analyses.map((analysis) => (
                      <div
                        key={analysis.id}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium capitalize">{analysis.analysis_type} Analysis</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(analysis.created_at)}
                                {analysis.period_id ? " • Period Analysis" : " • File-only Analysis"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={analysis.shared_with_client ? "default" : "secondary"}>
                              {analysis.shared_with_client ? "Shared" : "Private"}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {analysis.analysis_type}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const { error } = await supabase
                                  .from('ai_analysis')
                                  .update({ shared_with_client: !analysis.shared_with_client })
                                  .eq('id', analysis.id);
                                if (!error) {
                                  await fetchClientData();
                                  toast({
                                    title: analysis.shared_with_client ? "Analysis unshared" : "Analysis shared",
                                    description: analysis.shared_with_client
                                      ? "The analysis is no longer visible to the client"
                                      : "The analysis is now visible to the client"
                                  });
                                }
                              }}
                            >
                              <Share2 className="w-4 h-4 mr-2" />
                              {analysis.shared_with_client ? 'Unshare' : 'Share'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedAnalysis(expandedAnalysis === analysis.id ? null : analysis.id)}
                            >
                              <MessageCircle className="w-4 h-4 mr-2" />
                              Chat
                            </Button>
                          </div>
                        </div>
                        
                        <div className="prose prose-sm max-w-none">
                          <div className="whitespace-pre-wrap text-sm">
                            {analysis.analysis_result}
                          </div>
                        </div>
                        
                        {analysis.selected_uploads && analysis.selected_uploads.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Files analyzed:</p>
                            <div className="flex flex-wrap gap-1">
                              {analysis.selected_uploads.map((upload: any, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {upload.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {expandedAnalysis === analysis.id && (
                          <div className="border-t pt-4 mt-4">
                            <h4 className="font-medium mb-3">Continue Discussion</h4>
                            {conversations[analysis.id] && conversations[analysis.id].length > 0 && (
                              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                                {conversations[analysis.id].map((message, index) => (
                                  <div key={index} className={`p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'}`}>
                                    <div className="text-xs font-medium mb-1 capitalize">{message.role}</div>
                                    <div className="text-sm">{message.content}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Textarea
                                value={newMessages[analysis.id] || ''}
                                onChange={(e) => setNewMessages({ ...newMessages, [analysis.id]: e.target.value })}
                                placeholder="Ask a follow-up question about this analysis..."
                                rows={2}
                                className="flex-1"
                              />
                              <Button
                                onClick={async () => {
                                  const message = newMessages[analysis.id]?.trim();
                                  if (!message || !client) return;

                                  const currentConversation = conversations[analysis.id] || [];
                                  const updatedConversation = [
                                    ...currentConversation,
                                    { role: 'user' as const, content: message }
                                  ];
                                  setConversations({ ...conversations, [analysis.id]: updatedConversation });
                                  setNewMessages({ ...newMessages, [analysis.id]: '' });

                                  try {
                                    const result = await supabase.functions.invoke('analyze-performance', {
                                      body: {
                                        followUpPrompt: message,
                                        originalAnalysis: analysis.analysis_result,
                                        periodData: analysis.period?.form_data || null,
                                        agencyName: client.agency?.name
                                      }
                                    });

                                    if (result.data?.analysis) {
                                      setConversations({
                                        ...conversations,
                                        [analysis.id]: [
                                          ...updatedConversation,
                                          { role: 'assistant' as const, content: result.data.analysis }
                                        ]
                                      });
                                    }
                                  } catch (error) {
                                    toast({
                                      title: 'Error',
                                      description: 'Failed to get AI response',
                                      variant: 'destructive'
                                    });
                                  }
                                }}
                                disabled={!newMessages[analysis.id]?.trim()}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
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