import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Upload, 
  Video, 
  Loader2, 
  Check, 
  Trash2, 
  Eye, 
  Copy, 
  RefreshCw, 
  BookOpen, 
  ArrowLeft,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { LearningCycleReportCard } from "./LearningCycleReportCard";

const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];

interface VideoTrainingModule {
  id: string;
  title: string;
  content: string;
  role: 'leader' | 'community';
  used_in_huddle: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  video_storage_path?: string;
}

interface VideoTrainingDialogProps {
  onBack: () => void;
}

export function VideoTrainingDialog({ onBack }: VideoTrainingDialogProps) {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user'>('user');
  const [loading, setLoading] = useState(true);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modules state
  const [modules, setModules] = useState<VideoTrainingModule[]>([]);
  const [viewingModule, setViewingModule] = useState<VideoTrainingModule | null>(null);
  const [reportCardModule, setReportCardModule] = useState<VideoTrainingModule | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'upload' | 'vault'>('upload');

  // Polling ref
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadInitialData();
    }
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [user?.id]);

  const loadInitialData = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id, role')
        .eq('id', user?.id)
        .single();

      if (!profile?.agency_id) {
        toast.error('No agency found');
        return;
      }

      setAgencyId(profile.agency_id);
      setUserRole(profile.role === 'admin' ? 'admin' : 'user');
      await fetchModules(profile.agency_id);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async (agency: string) => {
    const { data, error } = await supabase
      .from('video_training_modules')
      .select('*')
      .eq('agency_id', agency)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch error:', error);
      return;
    }

    setModules((data || []) as VideoTrainingModule[]);

    // Check for processing modules and poll
    const processing = (data || []).filter(
      (m: any) => m.status === 'pending' || m.status === 'processing'
    );

    if (processing.length > 0) {
      pollForCompletion(agency, processing.map((m: any) => m.id));
    }
  };

  const pollForCompletion = useCallback((agency: string, moduleIds: string[]) => {
    if (pollingRef.current) clearTimeout(pollingRef.current);

    pollingRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('video_training_modules')
        .select('id, status, title')
        .in('id', moduleIds);

      if (!data) return;

      const stillProcessing = data.filter(
        (m: any) => m.status === 'pending' || m.status === 'processing'
      );
      const completed = data.filter((m: any) => m.status === 'completed');

      completed.forEach((m: any) => {
        toast.success(`"${m.title}" is ready!`, { duration: 5000 });
      });

      await fetchModules(agency);

      if (stillProcessing.length > 0) {
        pollForCompletion(agency, stillProcessing.map((m: any) => m.id));
      }
    }, 5000);
  }, []);

  const handleFileSelect = (file: File | null) => {
    setFileError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFileError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`File too large. Maximum size: ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !agencyId || !user?.id) return;

    setUploading(true);
    setUploadProgress(0);
    
    try {
      const moduleId = crypto.randomUUID();
      // Path: video-analysis/${agencyId}/${moduleId}/${filename}
      const storagePath = `video-analysis/${agencyId}/${moduleId}/${selectedFile.name}`;

      // Create pending record
      const { error: insertError } = await supabase
        .from('video_training_modules')
        .insert({
          id: moduleId,
          agency_id: agencyId,
          user_id: user.id,
          title: 'Analyzing video...',
          content: '',
          role: userRole === 'admin' ? 'leader' : 'community',
          status: 'pending',
          video_storage_path: storagePath
        });

      if (insertError) throw insertError;

      setUploadProgress(20);

      // Upload video to training-assets bucket
      const { error: uploadError } = await supabase.storage
        .from('training-assets')
        .upload(storagePath, selectedFile, { contentType: selectedFile.type });

      if (uploadError) {
        await supabase.from('video_training_modules').delete().eq('id', moduleId);
        throw uploadError;
      }

      setUploadProgress(60);

      // Trigger analysis - await to catch invocation errors
      const { error: invokeError } = await supabase.functions.invoke('analyze-training-video', {
        body: {
          storagePath,
          moduleId,
          agencyId,
          userId: user.id,
          role: userRole === 'admin' ? 'leader' : 'community'
        }
      });

      if (invokeError) {
        console.error('Edge function invocation error:', invokeError);
        // Mark module as failed so it doesn't stay pending forever
        await supabase
          .from('video_training_modules')
          .update({ 
            status: 'failed', 
            error_message: `Analysis failed to start: ${invokeError.message || 'Edge function error'}` 
          })
          .eq('id', moduleId);
        throw new Error(`Analysis failed to start: ${invokeError.message}`);
      }

      setUploadProgress(100);
      toast.success('Video uploaded! AI analysis in progress...');

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      await fetchModules(agencyId);
      pollForCompletion(agencyId, [moduleId]);
      setActiveTab('vault');

    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const toggleUsedInHuddle = async (moduleId: string, current: boolean) => {
    await supabase
      .from('video_training_modules')
      .update({ used_in_huddle: !current })
      .eq('id', moduleId);

    if (agencyId) await fetchModules(agencyId);
  };

  const deleteModule = async (moduleId: string) => {
    if (!confirm('Delete this training module?')) return;

    await supabase
      .from('video_training_modules')
      .delete()
      .eq('id', moduleId);

    toast.success('Module deleted');
    if (agencyId) await fetchModules(agencyId);
  };

  const retryAnalysis = async (module: VideoTrainingModule) => {
    if (!module.video_storage_path || !agencyId || !user?.id) {
      toast.error('Cannot retry: video no longer available');
      return;
    }

    await supabase
      .from('video_training_modules')
      .update({ status: 'processing', error_message: null })
      .eq('id', module.id);

    try {
      const { error: invokeError } = await supabase.functions.invoke('analyze-training-video', {
        body: {
          storagePath: module.video_storage_path,
          moduleId: module.id,
          agencyId,
          userId: user.id,
          role: module.role
        }
      });

      if (invokeError) {
        console.error('Retry invoke error:', invokeError);
        await supabase
          .from('video_training_modules')
          .update({ 
            status: 'failed', 
            error_message: `Retry failed: ${invokeError.message || 'Edge function error'}` 
          })
          .eq('id', module.id);
        toast.error('Retry failed - check logs');
        if (agencyId) await fetchModules(agencyId);
        return;
      }

      toast.success('Retrying analysis...');
    } catch (err: any) {
      console.error('Retry error:', err);
      await supabase
        .from('video_training_modules')
        .update({ 
          status: 'failed', 
          error_message: `Retry failed: ${err.message || 'Unknown error'}` 
        })
        .eq('id', module.id);
      toast.error('Retry failed');
    }
    if (agencyId) {
      await fetchModules(agencyId);
      pollForCompletion(agencyId, [module.id]);
    }
  };

  const copyContent = async (content: string) => {
    await navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Pending</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-600"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="gap-1 bg-green-500/20 text-green-600"><Check className="h-3 w-3" /> Ready</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Failed</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Module detail view
  if (viewingModule) {
    return (
      <div className="animate-enter">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => setViewingModule(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Button variant="outline" size="sm" onClick={() => copyContent(viewingModule.content)}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
        </div>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{viewingModule.content}</ReactMarkdown>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="animate-enter">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-medium">Video Training Architect</h3>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'vault')}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" /> Upload
          </TabsTrigger>
          <TabsTrigger value="vault" className="gap-2">
            <BookOpen className="h-4 w-4" /> Vault ({modules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div
                className="flex flex-col items-center justify-center gap-4 py-8 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileSelect(file);
                }}
              >
                <Video className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {selectedFile ? selectedFile.name : 'Drop video here or click to select'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max {MAX_FILE_SIZE_MB}MB • {ALLOWED_EXTENSIONS.join(', ')}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_EXTENSIONS.map(e => `video/${e.slice(1)}`).join(',')}
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                />
              </div>

              {fileError && (
                <p className="text-sm text-destructive text-center mt-2">{fileError}</p>
              )}

              {selectedFile && !fileError && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      Remove
                    </Button>
                  </div>

                  {uploading && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={handleUpload}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload & Analyze
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground text-center">
            <p>AI will analyze your video and generate a Learning Cycle Huddle framework.</p>
            <p className="mt-1">
              {userRole === 'admin' ? '✓ Leader prompt (strategic)' : '✓ Community prompt (tactical)'}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="vault">
          <ScrollArea className="h-[50vh]">
            {modules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No training modules yet</p>
                <p className="text-xs text-muted-foreground mt-1">Upload a video to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {modules.map((module) => (
                  <Card key={module.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusBadge(module.status)}
                            <Badge variant="outline" className="text-xs">
                              {module.role === 'leader' ? 'Leader' : 'Community'}
                            </Badge>
                          </div>
                          <h4 className="font-medium truncate">{module.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {new Date(module.created_at).toLocaleDateString()}
                          </p>
                          {module.error_message && (
                            <p className="text-xs text-destructive mt-1">{module.error_message}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {module.status === 'completed' && (
                            <>
                              <div className="flex items-center gap-1.5 mr-2">
                                <Checkbox
                                  id={`huddle-${module.id}`}
                                  checked={module.used_in_huddle}
                                  onCheckedChange={() => toggleUsedInHuddle(module.id, module.used_in_huddle)}
                                />
                                <label
                                  htmlFor={`huddle-${module.id}`}
                                  className="text-xs text-muted-foreground cursor-pointer"
                                >
                                  Used
                                </label>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  if (module.role === 'community') {
                                    setReportCardModule(module);
                                  } else {
                                    setViewingModule(module);
                                  }
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => copyContent(module.content)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {module.status === 'failed' && module.video_storage_path && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => retryAnalysis(module)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteModule(module.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Learning Cycle Report Card Dialog */}
      {reportCardModule && (
        <LearningCycleReportCard
          module={reportCardModule}
          open={!!reportCardModule}
          onClose={() => setReportCardModule(null)}
        />
      )}
    </div>
  );
}
