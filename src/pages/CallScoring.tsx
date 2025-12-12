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
  billing_period_start: string;
  billing_period_end: string;
}

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'];
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/ogg', 'audio/mp4'];
const MAX_SIZE_MB = 25;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function CallScoring() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  // TEMPORARY: Admin-only gate until feature is complete
  useEffect(() => {
    if (user && !isAdmin) {
      navigate('/');
      toast.error('Call Scoring is coming soon!');
    }
  }, [user, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsageAndCalls();
      fetchFormData();
    }
  }, [isAdmin]);

  const fetchUsageAndCalls = async () => {
    setLoading(true);
    
    setUsage({
      calls_used: 0,
      calls_limit: 20,
      billing_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      billing_period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
    });

    const { data: calls } = await supabase
      .from('agency_calls')
      .select(`
        id,
        overall_score,
        potential_rank,
        created_at,
        team_members(name)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    setRecentCalls(calls || []);
    setLoading(false);
  };

  const fetchFormData = async () => {
    const { data: members } = await supabase
      .from('team_members')
      .select('id, name')
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

  const canUpload = selectedFile && selectedTeamMember && selectedTemplate && 
    usage && usage.calls_used < usage.calls_limit && !uploading;

  const handleUpload = async () => {
    if (!canUpload || !selectedFile) return;
    
    setUploading(true);
    
    try {
      // Get current user's agency_id
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        toast.error('You must be logged in to upload calls');
        return;
      }

      // Get agency_id from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', authUser.id)
        .single();

      if (!profile?.agency_id) {
        toast.error('Could not determine your agency');
        return;
      }

      // Prepare form data
      const formData = new FormData();
      formData.append('audio', selectedFile);
      formData.append('team_member_id', selectedTeamMember);
      formData.append('template_id', selectedTemplate);
      formData.append('agency_id', profile.agency_id);
      formData.append('file_name', selectedFile.name);

      toast.info('Uploading and transcribing call... This may take a minute.');

      // Call edge function
      const { data, error } = await supabase.functions.invoke('transcribe-call', {
        body: formData,
      });

      if (error) {
        console.error('Transcription error:', error);
        toast.error('Failed to transcribe call: ' + error.message);
        return;
      }

      console.log('Transcription result:', data);
      toast.success('Call transcribed successfully!');

      // Log result for Phase 2D
      console.log('Transcript:', data.transcript);
      console.log('Duration:', data.duration_seconds, 'seconds');

      // Reset form
      setSelectedFile(null);
      setSelectedTeamMember('');
      setSelectedTemplate('');

    } catch (err) {
      console.error('Upload error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setUploading(false);
    }
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
        {usage && (
          <Badge variant="outline" className="text-sm px-3 py-1">
            {usage.calls_used} / {usage.calls_limit} calls this month
          </Badge>
        )}
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
            {usage && usage.calls_used >= usage.calls_limit && (
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
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze Call
                </>
              )}
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
            <CardDescription>
              Your last 10 analyzed calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-4">Loading...</p>
            ) : recentCalls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No calls analyzed yet</p>
                <p className="text-sm">Upload your first call to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentCalls.map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer"
                  >
                    <div>
                      <p className="font-medium">{call.team_members?.name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(call.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {call.overall_score !== null && (
                        <Badge variant={call.overall_score >= 70 ? 'default' : 'secondary'}>
                          {call.overall_score}/100
                        </Badge>
                      )}
                      {call.potential_rank && (
                        <Badge variant="outline">{call.potential_rank}</Badge>
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
