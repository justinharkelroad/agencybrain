import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Upload, FileText, Download, Trash2, ChevronDown, ChevronUp, Send, Share2, MessageSquare, Calendar, DollarSign, Users, TrendingUp, BarChart3, Target, Clock, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { fetchChatMessages, insertChatMessage, clearChatMessages, markMessageShared } from "@/utils/chatPersistence";
import type { Tables } from '@/integrations/supabase/types';

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  status: string;
  created_at: string;
}

type Period = Tables<'periods'>;

interface Upload {
  id: string;
  original_name: string;
  file_path: string;
  file_size: number;
  category: string;
  created_at: string;
}

interface Analysis {
  id: string;
  analysis_result: string;
  analysis_type: string;
  prompt_used?: string;
  selected_uploads?: any[];
  shared_with_client: boolean;
  created_at: string;
  period_id?: string;
}

type Prompt = Tables<'prompts'>;

type ConversationMessage = { role: "user" | "assistant"; content: string; id?: string; shared?: boolean };

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [client, setClient] = useState<Client | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [agencyName, setAgencyName] = useState<string>('Client');
  
  // Form states
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedUploads, setSelectedUploads] = useState<string[]>([]);
  
  // Chat states
  const [conversations, setConversations] = useState<Record<string, Array<ConversationMessage>>>({});
  const [newMessages, setNewMessages] = useState<Record<string, string>>({});
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<Record<string, boolean>>({});
  const [sharedReplies, setSharedReplies] = useState<Record<string, number[]>>({});

  // Guard to avoid syncing while hydrating from DB
  const isHydratingChatRef = React.useRef(false);
  // Track how many messages per analysis have been synced to DB to avoid double-inserts
  const lastSyncCountsRef = React.useRef<Record<string, number>>({});

  useEffect(() => {
    if (!clientId) {
      toast({ title: "Invalid URL", description: "Missing client ID", variant: "destructive" });
      navigate("/admin");
      return;
    }
    fetchClientData();
  }, [clientId]);

  // Load chat history from DB whenever a thread is expanded
  useEffect(() => {
    const load = async () => {
      if (!expandedAnalysis) return;
      try {
        isHydratingChatRef.current = true;
        console.log("[ClientDetail] Hydrating chat from DB for analysis", expandedAnalysis);
        const rows = await fetchChatMessages(expandedAnalysis);
        const msgs: ConversationMessage[] = rows.map(r => ({
          id: r.id,
          role: r.role,
          content: r.content,
          shared: r.shared_with_client,
        }));

        setConversations(prev => ({ ...prev, [expandedAnalysis]: msgs }));

        // Build shared indices for UI badges if you use them
        const assistantSharedIdx: number[] = [];
        let assistantIndex = -1;
        msgs.forEach(m => {
          if (m.role === "assistant") {
            assistantIndex += 1;
            if (m.shared) assistantSharedIdx.push(assistantIndex);
          }
        });
        setSharedReplies(prev => ({ ...prev, [expandedAnalysis]: assistantSharedIdx }));

        // Mark that these many messages are already in DB
        lastSyncCountsRef.current[expandedAnalysis] = msgs.length;
      } catch (e) {
        console.error("[ClientDetail] Failed to hydrate chat from DB", e);
        // Don't block UI; user can still chat and we'll insert as they type
      } finally {
        isHydratingChatRef.current = false;
      }
    };
    load();
  }, [expandedAnalysis]);

  // Auto-sync newly added local messages to DB (append-only assumption)
  useEffect(() => {
    if (isHydratingChatRef.current) return;

    const sync = async () => {
      const entries = Object.entries(conversations);
      for (const [analysisId, msgs] of entries) {
        const last = lastSyncCountsRef.current[analysisId] ?? 0;

        // Nothing new
        if (!Array.isArray(msgs) || msgs.length <= last) continue;

        // Insert new messages starting from 'last'
        for (let i = last; i < msgs.length; i++) {
          const m = msgs[i] as ConversationMessage;
          // If already has an id, skip
          if (m.id) {
            lastSyncCountsRef.current[analysisId] = i + 1;
            continue;
          }
          try {
            const inserted = await insertChatMessage(analysisId, m.role, m.content);
            // Attach id to the message in local state
            setConversations(prev => {
              const list = prev[analysisId] ? [...prev[analysisId]] : [];
              if (list[i]) {
                list[i] = { ...list[i], id: inserted.id };
              }
              return { ...prev, [analysisId]: list };
            });
            lastSyncCountsRef.current[analysisId] = i + 1;
          } catch (e) {
            console.error("[ClientDetail] Failed syncing chat message to DB", e);
            // We don't throw here; user can retry by re-sending or continuing
          }
        }
      }
    };

    sync();
  }, [conversations]);

  // Persist shared flags to DB when they change (for assistant messages only)
  const prevSharedRef = React.useRef<Record<string, number[]>>({});
  useEffect(() => {
    const entries = Object.entries(sharedReplies);
    for (const [analysisId, indices] of entries) {
      const prev = prevSharedRef.current[analysisId] || [];
      const newlyShared = indices.filter(i => !prev.includes(i));

      if (newlyShared.length > 0 && Array.isArray(conversations[analysisId])) {
        let assistantSeen = -1;
        conversations[analysisId].forEach((m, idx) => {
          if (m.role !== "assistant") return;
          assistantSeen += 1;
          if (newlyShared.includes(assistantSeen) && m.id) {
            // Mark in DB
            markMessageShared(m.id, true).catch(err => {
              console.error("[ClientDetail] Failed to mark message shared", err);
            });
            // Also reflect in local state for consistency
            setConversations(prev => {
              const list = prev[analysisId] ? [...prev[analysisId]] : [];
              if (list[idx]) list[idx] = { ...list[idx], shared: true };
              return { ...prev, [analysisId]: list };
            });
          }
        });
      }
    }
    prevSharedRef.current = sharedReplies;
  }, [sharedReplies, conversations]);

  // Load conversations from localStorage on mount
  useEffect(() => {
    if (!client?.id) return;
    
    const savedConversations = localStorage.getItem(`conversations_${client.id}`);
    const savedMessages = localStorage.getItem(`newMessages_${client.id}`);
    const savedShared = localStorage.getItem(`sharedReplies_${client.id}`);
    
    if (savedConversations) {
      try {
        setConversations(JSON.parse(savedConversations));
      } catch (e) {
        console.error('Failed to parse saved conversations:', e);
      }
    }
    
    if (savedMessages) {
      try {
        setNewMessages(JSON.parse(savedMessages));
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
    
    if (savedShared) {
      try {
        setSharedReplies(JSON.parse(savedShared));
      } catch (e) {
        console.error('Failed to parse saved shared replies:', e);
      }
    }
  }, [client?.id]);

  // Save conversations to localStorage when they change
  useEffect(() => {
    if (!client?.id) return;
    localStorage.setItem(`conversations_${client.id}`, JSON.stringify(conversations));
  }, [conversations, client?.id]);

  // Save new messages to localStorage when they change
  useEffect(() => {
    if (!client?.id) return;
    localStorage.setItem(`newMessages_${client.id}`, JSON.stringify(newMessages));
  }, [newMessages, client?.id]);

  // Save shared replies to localStorage when they change
  useEffect(() => {
    if (!client?.id) return;
    localStorage.setItem(`sharedReplies_${client.id}`, JSON.stringify(sharedReplies));
  }, [sharedReplies, client?.id]);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      
      // Fetch client details
      const { data: clientData, error: clientError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', clientId)
        .single();
      
      if (clientError) throw clientError;
      setClient(clientData);
      // Resolve agency name for header
      try {
        if (clientData?.agency_id) {
          const { data: agency, error: agencyError } = await supabase
            .from('agencies')
            .select('name')
            .eq('id', clientData.agency_id)
            .maybeSingle();
          if (agencyError) {
            console.warn('[ClientDetail] Failed to fetch agency name', agencyError);
            setAgencyName('Client');
          } else {
            setAgencyName(agency?.name || 'Client');
          }
        } else {
          setAgencyName('Client');
        }
      } catch (e) {
        console.warn('[ClientDetail] Agency name lookup failed', e);
        setAgencyName('Client');
      }
      
      // Fetch periods
      const { data: periodsData, error: periodsError } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', clientId)
        .order('created_at', { ascending: false });
      
      if (periodsError) throw periodsError;
      setPeriods(periodsData || []);
      
      // Fetch uploads
      const { data: uploadsData, error: uploadsError } = await supabase
        .from('uploads')
        .select('*')
        .eq('user_id', clientId)
        .order('created_at', { ascending: false });
      
      if (uploadsError) throw uploadsError;
      setUploads(uploadsData || []);
      
      // Fetch analyses
      const { data: analysesData, error: analysesError } = await supabase
        .from('ai_analysis')
        .select('*')
        .eq('user_id', clientId)
        .order('created_at', { ascending: false });
      
      if (analysesError) throw analysesError;
      setAnalyses(analysesData || []);
      
      // Fetch prompts
      const { data: promptsData, error: promptsError } = await supabase
        .from('prompts')
        .select('id,title,content,category')
        .eq('is_active', true)
        .order('title', { ascending: true });
      
      if (promptsError) throw promptsError;
      setPrompts((promptsData as Prompt[]) || []);
      
    } catch (error: any) {
      console.error('Error fetching client data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch client data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    
    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${clientId}/${fileName}`;
        
        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        // Save file metadata to database
        const { error: dbError } = await supabase
          .from('uploads')
          .insert({
            user_id: clientId,
            original_name: file.name,
            file_path: filePath,
            file_size: file.size,
            category: category,
          });
        
        if (dbError) throw dbError;
      }
      
      toast({
        title: "Success",
        description: `${files.length} file(s) uploaded successfully`,
      });
      
      // Refresh uploads
      fetchClientData();
      
    } catch (error: any) {
      console.error('Error uploading files:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteUpload = async (upload: Upload) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('uploads')
        .remove([upload.file_path]);
      
      if (storageError) throw storageError;
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('uploads')
        .delete()
        .eq('id', upload.id);
      
      if (dbError) throw dbError;
      
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
      
      // Refresh uploads
      fetchClientData();
      
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const handleDownloadUpload = async (upload: Upload) => {
    try {
      const { data, error } = await supabase.storage
        .from('uploads')
        .download(upload.file_path);
      
      if (error) throw error;
      
      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = upload.original_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error: any) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const handleAnalyze = async () => {
    if (!selectedPeriod && selectedUploads.length === 0) {
      toast({
        title: "Error",
        description: "Please select a period or files to analyze",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedPrompt && !customPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please select a prompt or enter a custom prompt",
        variant: "destructive",
      });
      return;
    }
    
    setAnalyzing(true);
    
    try {
      // Get period data if selected
      let periodData = null;
      if (selectedPeriod) {
        const period = periods.find(p => p.id === selectedPeriod);
        if (period) {
          const d = (period as any).form_data || {};
          periodData = {
            sales: d.sales,
            marketing: d.marketing,
            operations: d.operations,
            retention: d.retention,
            cashFlow: d.cashFlow,
            qualitative: d.qualitative,
          };
        }
      }
      
      // Get selected uploads
      const selectedUploadData = uploads.filter(u => selectedUploads.includes(u.id));
      
      // Get prompt content
      let promptContent = customPrompt.trim();
      if (selectedPrompt && !promptContent) {
        const prompt = prompts.find(p => p.id === selectedPrompt);
        promptContent = prompt?.content || '';
      }
      
      // Call analysis function
      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: {
          periodData,
          uploads: selectedUploadData,
          agencyName: agencyName,
          promptCategory: prompts.find(p => p.id === selectedPrompt)?.category || 'performance',
          customPrompt: customPrompt.trim() || undefined,
        },
      });
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Analysis completed successfully",
      });
      
      // Refresh analyses
      fetchClientData();
      
      // Reset form
      setSelectedPeriod('');
      setSelectedPrompt('');
      setCustomPrompt('');
      setSelectedUploads([]);
      
    } catch (error: any) {
      console.error('Error analyzing:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to analyze data",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSendFollowUp = async (analysisId: string) => {
    const message = newMessages[analysisId]?.trim();
    if (!message) return;
    
    setIsSending(prev => ({ ...prev, [analysisId]: true }));
    
    try {
      // Add user message to conversation
      const userMessage = { role: 'user' as const, content: message };
      setConversations(prev => ({
        ...prev,
        [analysisId]: [...(prev[analysisId] || []), userMessage]
      }));
      
      // Clear input
      setNewMessages(prev => ({ ...prev, [analysisId]: '' }));
      
      // Get analysis data for context
      const analysis = analyses.find(a => a.id === analysisId);
      if (!analysis) throw new Error('Analysis not found');
      
      // Get period data if analysis has period_id
      let periodData = null;
      if (analysis.period_id) {
        const period = periods.find(p => p.id === analysis.period_id);
        if (period) {
          const d = (period as any).form_data || {};
          periodData = {
            sales: d.sales,
            marketing: d.marketing,
            operations: d.operations,
            retention: d.retention,
            cashFlow: d.cashFlow,
            qualitative: d.qualitative,
          };
        }
      }
      
      // Get uploads data if analysis has selected_uploads
      let uploadsData = [];
      if (analysis.selected_uploads && Array.isArray(analysis.selected_uploads)) {
        uploadsData = uploads.filter(u => 
          analysis.selected_uploads.some((su: any) => su.id === u.id)
        );
      }
      
      // Call analysis function with follow-up
      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: {
          periodData,
          uploads: uploadsData,
          agencyName: client?.company || client?.name || 'Agency',
          followUpPrompt: message,
          originalAnalysis: analysis.analysis_result,
        },
      });
      
      if (error) throw error;
      
      // Add assistant response to conversation
      const assistantMessage = { role: 'assistant' as const, content: data.analysis };
      setConversations(prev => ({
        ...prev,
        [analysisId]: [...(prev[analysisId] || []), assistantMessage]
      }));
      
    } catch (error: any) {
      console.error('Error sending follow-up:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send follow-up",
        variant: "destructive",
      });
    } finally {
      setIsSending(prev => ({ ...prev, [analysisId]: false }));
    }
  };

  const handleShareReply = (analysisId: string, replyIndex: number) => {
    setSharedReplies(prev => {
      const current = prev[analysisId] || [];
      const isShared = current.includes(replyIndex);
      
      if (isShared) {
        return {
          ...prev,
          [analysisId]: current.filter(i => i !== replyIndex)
        };
      } else {
        return {
          ...prev,
          [analysisId]: [...current, replyIndex]
        };
      }
    });
  };

  const handleClearChat = async (analysisId: string) => {
    try {
      await clearChatMessages(analysisId);
      // Clear local state
      setConversations(prev => {
        const next = { ...prev };
        delete next[analysisId];
        return next;
      });
      setNewMessages(prev => {
        const next = { ...prev };
        delete next[analysisId];
        return next;
      });
      setSharedReplies(prev => {
        const next = { ...prev };
        delete next[analysisId];
        return next;
      });
      delete lastSyncCountsRef.current[analysisId];
      // Also clear any localStorage cache already implemented
      // Note: existing effects keep using these keys
      // localStorage keys are built with client.id in your previous change
      toast({ title: "Chat cleared", description: "Conversation removed from the server and locally." });
    } catch (e: any) {
      console.error("[ClientDetail] Clear chat failed", e);
      toast({ title: "Failed to clear chat", description: e?.message || "Please try again." });
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading client data...</div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">Client not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{agencyName}</h1>
          </div>
        </div>
      </div>

      {/* Client info card removed per request; displaying agency name in header only */}

      <Tabs defaultValue="periods" className="space-y-6">
        <TabsList>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          <TabsTrigger value="uploads">Files</TabsTrigger>
          <TabsTrigger value="analyze">Analyze</TabsTrigger>
          <TabsTrigger value="analyses">Results</TabsTrigger>
        </TabsList>

        {/* Periods Tab */}
        <TabsContent value="periods">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Performance Periods
              </CardTitle>
            </CardHeader>
            <CardContent>
              {periods.length === 0 ? (
                <p className="text-muted-foreground">No periods found for this client.</p>
              ) : (
                <div className="space-y-4">
                  {periods.map((period) => (
                    <Card key={period.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{period.title}</h3>
                        <Badge variant={period.status === 'completed' ? 'default' : 'secondary'}>
                          {period.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()}
                      </p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                        {(period.form_data as any)?.sales && (
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span>Sales Data</span>
                          </div>
                        )}
                        {(period.form_data as any)?.marketing && (
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                            <span>Marketing</span>
                          </div>
                        )}
                        {(period.form_data as any)?.operations && (
                          <div className="flex items-center space-x-2">
                            <BarChart3 className="h-4 w-4 text-purple-600" />
                            <span>Operations</span>
                          </div>
                        )}
                        {(period.form_data as any)?.retention && (
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-orange-600" />
                            <span>Retention</span>
                          </div>
                        )}
                        {(period.form_data as any)?.cashFlow && (
                          <div className="flex items-center space-x-2">
                            <Target className="h-4 w-4 text-red-600" />
                            <span>Cash Flow</span>
                          </div>
                        )}
                        {(period.form_data as any)?.qualitative && (
                          <div className="flex items-center space-x-2">
                            <MessageSquare className="h-4 w-4 text-gray-600" />
                            <span>Qualitative</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="uploads">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Uploaded Files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Upload Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['transcripts', 'reports', 'other'].map((category) => (
                  <div key={category} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <h3 className="font-medium mb-2 capitalize">{category}</h3>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => handleFileUpload(e, category)}
                      className="hidden"
                      id={`upload-${category}`}
                      disabled={uploading}
                    />
                    <label
                      htmlFor={`upload-${category}`}
                      className="cursor-pointer text-sm text-blue-600 hover:text-blue-800"
                    >
                      {uploading ? 'Uploading...' : 'Choose files'}
                    </label>
                  </div>
                ))}
              </div>

              {/* Files List */}
              {uploads.length === 0 ? (
                <p className="text-muted-foreground">No files uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {uploads.map((upload) => (
                    <div key={upload.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-gray-500" />
                        <div>
                          <p className="font-medium">{upload.original_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {upload.category} • {formatFileSize(upload.file_size)} • {formatDate(upload.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadUpload(upload)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUpload(upload)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analyze Tab */}
        <TabsContent value="analyze">
          <Card>
            <CardHeader>
              <CardTitle>Run Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Period Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Select Period (Optional)</label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a period to analyze" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.title} ({new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Select Files (Optional)</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {uploads.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No files available</p>
                  ) : (
                    uploads.map((upload) => (
                      <div key={upload.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={upload.id}
                          checked={selectedUploads.includes(upload.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUploads(prev => [...prev, upload.id]);
                            } else {
                              setSelectedUploads(prev => prev.filter(id => id !== upload.id));
                            }
                          }}
                        />
                        <label htmlFor={upload.id} className="text-sm cursor-pointer">
                          {upload.original_name} ({upload.category})
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Prompt Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Analysis Prompt</label>
                  <Button variant="link" asChild>
                    <Link to="/admin/prompts">Manage prompt library</Link>
                  </Button>
                </div>
                <Select value={selectedPrompt} onValueChange={setSelectedPrompt}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a prompt template" />
                  </SelectTrigger>
                  <SelectContent>
                    {prompts.map((prompt) => (
                      <SelectItem key={prompt.id} value={prompt.id}>
                        {prompt.title} ({prompt.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Prompt */}
              <div>
                <label className="text-sm font-medium mb-2 block">Custom Prompt (Optional)</label>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Enter a custom analysis prompt..."
                  rows={4}
                />
              </div>

              {/* Analyze Button */}
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || (!selectedPeriod && selectedUploads.length === 0) || (!selectedPrompt && !customPrompt.trim())}
                className="w-full"
              >
                {analyzing ? 'Analyzing...' : 'Run Analysis'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="analyses">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
              {analyses.length === 0 ? (
                <p className="text-muted-foreground">No analyses found for this client.</p>
              ) : (
                <div className="space-y-4">
                  {analyses.map((analysis) => (
                    <Card key={analysis.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{analysis.analysis_type}</Badge>
                          {analysis.shared_with_client && (
                            <Badge variant="default">Shared</Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">
                            {formatDate(analysis.created_at)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedAnalysis(expandedAnalysis === analysis.id ? null : analysis.id)}
                          >
                            {expandedAnalysis === analysis.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="prose prose-sm max-w-none mb-4">
                        <div className="whitespace-pre-wrap text-sm bg-gray-50 text-gray-900 p-3 rounded-lg">
                          {analysis.analysis_result && analysis.analysis_result.trim().length > 0 ? analysis.analysis_result : 'No analysis content available.'}
                        </div>
                      </div>

                      {/* Expanded Section - Chat */}
                      {expandedAnalysis === analysis.id && (
                        <div className="border-t pt-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium flex items-center">
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Continue Discussion
                            </h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleClearChat(analysis.id)}
                            >
                              Clear chat
                            </Button>
                          </div>

                          {/* Chat Messages */}
                          {conversations[analysis.id] && conversations[analysis.id].length > 0 && (
                            <div className="space-y-3 max-h-60 overflow-y-auto">
                              {conversations[analysis.id].map((message, index) => {
                                const isAssistant = message.role === 'assistant';
                                let assistantIndex = -1;
                                if (isAssistant) {
                                  // Calculate which assistant message this is
                                  for (let i = 0; i <= index; i++) {
                                    if (conversations[analysis.id][i].role === 'assistant') {
                                      assistantIndex++;
                                    }
                                  }
                                }
                                
                                return (
                                  <div
                                    key={index}
                                    className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
                                  >
                                    <div
                                      className={`max-w-[80%] p-3 rounded-lg ${
                                        isAssistant
                                          ? 'bg-gray-100 text-gray-900'
                                          : 'bg-blue-600 text-white'
                                      }`}
                                    >
                                      <div className="whitespace-pre-wrap text-sm">
                                        {message.content}
                                      </div>
                                      {isAssistant && (
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                                          <div className="flex items-center space-x-2">
                                            {sharedReplies[analysis.id]?.includes(assistantIndex) && (
                                              <Badge variant="secondary" className="text-xs">
                                                Shared
                                              </Badge>
                                            )}
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleShareReply(analysis.id, assistantIndex)}
                                            className="h-6 px-2 text-xs"
                                          >
                                            <Share2 className="h-3 w-3 mr-1" />
                                            {sharedReplies[analysis.id]?.includes(assistantIndex) ? 'Unshare' : 'Share'}
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Message Input */}
                          <div className="flex space-x-2">
                            <Input
                              value={newMessages[analysis.id] || ''}
                              onChange={(e) => setNewMessages(prev => ({
                                ...prev,
                                [analysis.id]: e.target.value
                              }))}
                              placeholder="Ask a follow-up question..."
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendFollowUp(analysis.id);
                                }
                              }}
                              disabled={isSending[analysis.id]}
                            />
                            <Button
                              onClick={() => handleSendFollowUp(analysis.id)}
                              disabled={!newMessages[analysis.id]?.trim() || isSending[analysis.id]}
                              size="sm"
                            >
                              {isSending[analysis.id] ? (
                                <Clock className="h-4 w-4" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
