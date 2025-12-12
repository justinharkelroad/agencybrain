import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Phone, Upload, Clock, FileAudio, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UsageInfo {
  calls_used: number;
  calls_limit: number;
}

interface RecentCall {
  id: string;
  original_filename: string;
  call_duration_seconds: number;
  status: string;
  overall_score: number | null;
  created_at: string;
  team_member_name: string;
}

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'];
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/ogg', 'audio/mp4'];
const MAX_SIZE_MB = 25;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function CallScoring() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState<UsageInfo>({ calls_used: 0, calls_limit: 20 });
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  
  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  // uploading state removed - now non-blocking

  // TEMPORARY: Admin-only gate until feature is complete
  useEffect(() => {
    if (user && !isAdmin) {
      navigate('/');
      toast.error('Call Scoring is coming soon!');
    }
  }, [user, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin && user) {
      fetchAgencyAndData();
    }
  }, [isAdmin, user]);

  const fetchAgencyAndData = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user!.id)
        .single();

      if (profile?.agency_id) {
        setAgencyId(profile.agency_id);
        await Promise.all([
          fetchUsageAndCalls(profile.agency_id),
          fetchFormData(profile.agency_id)
        ]);
      }
    } catch (err) {
      console.error('Error fetching agency data:', err);
    }
  };

  const fetchUsageAndCalls = async (agency: string) => {
    setLoading(true);
    
    try {
      // Fetch usage for current month
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      
      const { data: usageData } = await supabase
        .from('call_usage_tracking')
        .select('calls_used, calls_limit')
        .eq('agency_id', agency)
        .eq('billing_period_start', periodStart)
        .single();

      setUsage(usageData || { calls_used: 0, calls_limit: 20 });

      // Fetch recent calls
      const { data: callsData } = await supabase
        .from('agency_calls')
        .select('id, original_filename, call_duration_seconds, status, overall_score, created_at, team_member_id')
        .eq('agency_id', agency)
        .order('created_at', { ascending: false })
        .limit(10);

      if (callsData && callsData.length > 0) {
        // Fetch team member names separately
        const teamMemberIds = [...new Set(callsData.map(c => c.team_member_id))];
        const { data: membersData } = await supabase
          .from('team_members')
          .select('id, name')
          .in('id', teamMemberIds);

        const memberMap = new Map(membersData?.map(m => [m.id, m.name]) || []);
        
        const enrichedCalls: RecentCall[] = callsData.map(call => ({
          id: call.id,
          original_filename: call.original_filename || 'Unknown file',
          call_duration_seconds: call.call_duration_seconds || 0,
          status: call.status || 'unknown',
          overall_score: call.overall_score,
          created_at: call.created_at,
          team_member_name: memberMap.get(call.team_member_id) || 'Unknown'
        }));
        
        setRecentCalls(enrichedCalls);
      } else {
        setRecentCalls([]);
      }
    } catch (err) {
      console.error('Error fetching calls:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFormData = async (agency: string) => {
    const { data: members } = await supabase
      .from('team_members')
      .select('id, name')
      .eq('agency_id', agency)
      .eq('status', 'active')
      .order('name');
    setTeamMembers(members || []);

    const { data: temps } = await supabase
      .from('call_scoring_templates')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    setTemplates(temps || []);
  };

  const handleFileSelect = (file: File | null) => {
    setFileError(null);
    
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension) && !ALLOWED_TYPES.includes(file.type)) {
      setFileError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setFileError(`File too large. Maximum size: ${MAX_SIZE_MB}MB`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFileSelect(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const canUpload = selectedFile && selectedTeamMember && selectedTemplate && 
    usage.calls_used < usage.calls_limit;

  const handleUpload = async () => {
    if (!canUpload || !selectedFile || !agencyId) return;
    
    // Capture current values before resetting
    const fileToUpload = selectedFile;
    const teamMemberId = selectedTeamMember;
    const templateId = selectedTemplate;
    const currentAgencyId = agencyId;

    // IMMEDIATELY reset form and show toast - don't wait for upload
    setSelectedFile(null);
    setSelectedTeamMember('');
    setSelectedTemplate('');
    
    toast.info('Call uploaded! Transcription and analysis in progress...', {
      duration: 5000,
    });

    // Process in background (don't await)
    processCallInBackground(fileToUpload, teamMemberId, templateId, currentAgencyId);
  };

  // Separate background function
  const processCallInBackground = async (
    file: File,
    teamMemberId: string,
    templateId: string,
    agencyIdParam: string
  ) => {
    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('team_member_id', teamMemberId);
      formData.append('template_id', templateId);
      formData.append('agency_id', agencyIdParam);
      formData.append('file_name', file.name);

      const { data, error } = await supabase.functions.invoke('transcribe-call', {
        body: formData,
      });

      if (error) {
        console.error('Transcription error:', error);
        toast.error('Transcription failed: ' + error.message);
        return;
      }

      console.log('Transcription complete:', data);
      
      // Refresh the calls list to show new entry
      if (agencyId) {
        fetchUsageAndCalls(agencyId);
      }
      
      toast.success(`"${file.name}" transcribed! Analysis in progress...`);

      // Poll for analysis completion
      if (data.call_id) {
        pollForAnalysis(data.call_id, file.name);
      }

    } catch (err) {
      console.error('Background processing error:', err);
      toast.error('Processing failed');
    }
  };

  // Poll to notify when analysis is done
  const pollForAnalysis = async (callId: string, fileName: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 3 seconds = 90 seconds max
    
    const checkStatus = async () => {
      attempts++;
      
      const { data } = await supabase
        .from('agency_calls')
        .select('status, overall_score')
        .eq('id', callId)
        .single();

      if (data?.status === 'analyzed' && data?.overall_score !== null) {
        toast.success(`"${fileName}" analysis complete: ${data.overall_score}%`, {
          duration: 5000,
        });
        if (agencyId) {
          fetchUsageAndCalls(agencyId); // Refresh to show score
        }
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(checkStatus, 3000); // Check every 3 seconds
      }
    };

    // Start polling after a short delay
    setTimeout(checkStatus, 5000);
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header with Usage Badge */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" />
            Call Scoring
          </h1>
          <p className="text-muted-foreground">
            Upload sales calls for AI-powered coaching analysis
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          {usage.calls_used} / {usage.calls_limit} calls this month
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Call Recording
            </CardTitle>
            <CardDescription>
              Upload an audio file to analyze (MP3, WAV, M4A, OGG - max 25MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${selectedFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}
                ${fileError ? 'border-destructive bg-destructive/5' : ''}`}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,audio/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
              
              {selectedFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <FileAudio className="h-8 w-8" />
                  </div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    Drag & drop an audio file, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    MP3, WAV, M4A, OGG up to 25MB
                  </p>
                </div>
              )}
            </div>

            {fileError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {fileError}
              </p>
            )}

            {/* Team Member Dropdown */}
            <div className="space-y-2">
              <Label>Team Member</Label>
              <Select value={selectedTeamMember} onValueChange={setSelectedTeamMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template Dropdown */}
            <div className="space-y-2">
              <Label>Scoring Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Usage Warning */}
            {usage.calls_used >= usage.calls_limit && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Monthly limit reached. Upgrade to analyze more calls.
              </p>
            )}

            {/* Upload Button */}
            <Button 
              className="w-full" 
              disabled={!canUpload}
              onClick={handleUpload}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Analyze Call
            </Button>
          </CardContent>
        </Card>

        {/* Right Column - Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Calls
            </CardTitle>
            <CardDescription>Your last 10 analyzed calls</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentCalls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No calls analyzed yet</p>
                <p className="text-sm">Upload your first call to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCalls.map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <FileAudio className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {call.team_member_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {call.original_filename}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm">
                          {formatDuration(call.call_duration_seconds)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(call.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {call.status === 'analyzed' && call.overall_score !== null ? (
                        <div className={`px-2 py-1 rounded text-sm font-medium ${
                          call.overall_score >= 80 ? 'bg-green-500/20 text-green-400' :
                          call.overall_score >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {call.overall_score}%
                        </div>
                      ) : call.status === 'analyzing' ? (
                        <div className="px-2 py-1 rounded text-sm bg-blue-500/20 text-blue-400 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Analyzing
                        </div>
                      ) : (
                        <div className="px-2 py-1 rounded text-sm bg-muted text-muted-foreground">
                          Pending
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
