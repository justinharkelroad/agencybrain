import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, Trash2, Plus, HelpCircle, Play, FileText, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { HelpModal } from '@/components/HelpModal';
import { useDropzone } from 'react-dropzone';

interface HelpContent {
  id: string;
  video_key: string;
  title: string;
  url: string;
  video_type: 'youtube' | 'loom';
  pdf_url: string | null;
  placement_description: string | null;
  is_active: boolean;
}

export function HelpContentManager() {
  const [contents, setContents] = useState<HelpContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingContent, setEditingContent] = useState<HelpContent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [formData, setFormData] = useState({
    video_key: '',
    title: '',
    url: '',
    video_type: 'youtube' as 'youtube' | 'loom',
    pdf_url: '',
    placement_description: ''
  });

  const fetchContents = async () => {
    const { data, error } = await supabase
      .from('help_videos')
      .select('*')
      .order('video_key');
    
    if (error) {
      toast.error('Failed to load help content');
      return;
    }
    setContents((data || []) as HelpContent[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchContents();
  }, []);

  const convertToEmbedUrl = (url: string, type: 'youtube' | 'loom'): string => {
    if (!url) return '';
    
    if (type === 'youtube') {
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      ];
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return `https://www.youtube.com/embed/${match[1]}`;
        }
      }
    } else if (type === 'loom') {
      const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
      if (match) {
        return `https://www.loom.com/embed/${match[1]}`;
      }
    }
    return url;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !formData.video_key) {
      toast.error('Please enter a video key first');
      return;
    }

    setUploadingPdf(true);
    try {
      const path = `${formData.video_key.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      
      const { error: uploadError } = await supabase.storage
        .from('help-pdfs')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('help-pdfs')
        .getPublicUrl(path);

      setFormData(prev => ({ ...prev, pdf_url: publicUrl }));
      toast.success('PDF uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload PDF');
    } finally {
      setUploadingPdf(false);
    }
  }, [formData.video_key]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: !formData.video_key || uploadingPdf
  });

  const handleSave = async () => {
    const embedUrl = convertToEmbedUrl(formData.url, formData.video_type);
    
    const payload = {
      video_key: formData.video_key,
      title: formData.title,
      url: embedUrl,
      video_type: formData.video_type,
      pdf_url: formData.pdf_url || null,
      placement_description: formData.placement_description || null,
      updated_at: new Date().toISOString()
    };

    if (editingContent) {
      const { error } = await supabase
        .from('help_videos')
        .update(payload)
        .eq('id', editingContent.id);
      
      if (error) {
        toast.error('Failed to update content');
        return;
      }
      toast.success('Content updated');
    } else {
      const { error } = await supabase
        .from('help_videos')
        .insert(payload);
      
      if (error) {
        if (error.code === '23505') {
          toast.error('A content entry with this key already exists');
        } else {
          toast.error('Failed to add content');
        }
        return;
      }
      toast.success('Content added');
    }

    setDialogOpen(false);
    setEditingContent(null);
    setFormData({ video_key: '', title: '', url: '', video_type: 'youtube', pdf_url: '', placement_description: '' });
    fetchContents();
  };

  const handleEdit = (content: HelpContent) => {
    setEditingContent(content);
    setFormData({
      video_key: content.video_key,
      title: content.title,
      url: content.url,
      video_type: content.video_type,
      pdf_url: content.pdf_url || '',
      placement_description: content.placement_description || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Clear content? The button will still exist but won\'t show until you add new content.')) return;
    
    const { error } = await supabase
      .from('help_videos')
      .update({ url: '', pdf_url: null, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to clear content');
      return;
    }
    toast.success('Content cleared');
    fetchContents();
  };

  const handleAddNew = () => {
    setEditingContent(null);
    setFormData({ video_key: '', title: '', url: '', video_type: 'youtube', pdf_url: '', placement_description: '' });
    setDialogOpen(true);
  };

  const clearPdfUrl = () => {
    setFormData(prev => ({ ...prev, pdf_url: '' }));
  };

  const [previewContent, setPreviewContent] = useState<HelpContent | null>(null);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-48" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Help Content
            </CardTitle>
            <CardDescription>
              Manage training videos and PDF walkthroughs that appear throughout the app
            </CardDescription>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Content
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Placement</TableHead>
              <TableHead>Content</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contents.map((content) => {
              const hasVideo = content.url && content.url.trim() !== '';
              const hasPdf = content.pdf_url && content.pdf_url.trim() !== '';
              const hasContent = hasVideo || hasPdf;

              return (
                <TableRow key={content.id}>
                  <TableCell className="font-mono text-sm">{content.video_key}</TableCell>
                  <TableCell>{content.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {content.placement_description || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {hasVideo && (
                        <span className="flex items-center gap-1 text-green-600 text-xs">
                          <Play className="h-3 w-3" /> Video
                        </span>
                      )}
                      {hasPdf && (
                        <span className="flex items-center gap-1 text-blue-600 text-xs">
                          <FileText className="h-3 w-3" /> PDF
                        </span>
                      )}
                      {!hasContent && (
                        <span className="text-muted-foreground text-xs">○ None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {hasContent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                          onClick={() => setPreviewContent(content)}
                          title={`Preview: ${content.title}`}
                        >
                          <HelpCircle className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(content)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {hasContent && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(content.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingContent ? 'Edit Help Content' : 'Add Help Content'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Content Key</Label>
                <Input
                  value={formData.video_key}
                  onChange={(e) => setFormData({ ...formData, video_key: e.target.value })}
                  placeholder="dashboard-overview"
                  disabled={!!editingContent}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Unique identifier (cannot change after creation)
                </p>
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Dashboard Overview"
                />
              </div>
              
              {/* Video Section */}
              <div className="space-y-2 p-3 border rounded-lg">
                <Label className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  Video (optional)
                </Label>
                <Select
                  value={formData.video_type}
                  onValueChange={(v) => setFormData({ ...formData, video_type: v as 'youtube' | 'loom' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="loom">Loom</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="Paste YouTube or Loom link here"
                />
              </div>

              {/* PDF Section */}
              <div className="space-y-2 p-3 border rounded-lg">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  PDF Walkthrough (optional)
                </Label>
                {formData.pdf_url ? (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-sm flex-1 truncate">{formData.pdf_url.split('/').pop()}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearPdfUrl}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                      ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                      ${!formData.video_key ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    {uploadingPdf ? (
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    ) : !formData.video_key ? (
                      <p className="text-sm text-muted-foreground">Enter a content key first</p>
                    ) : isDragActive ? (
                      <p className="text-sm text-primary">Drop PDF here</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Drag & drop PDF or click to browse
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label>Placement Notes (optional)</Label>
                <Input
                  value={formData.placement_description}
                  onChange={(e) => setFormData({ ...formData, placement_description: e.target.value })}
                  placeholder="Where this button appears"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {previewContent && (
          <HelpModal
            open={!!previewContent}
            onClose={() => setPreviewContent(null)}
            title={previewContent.title}
            videoUrl={previewContent.url || undefined}
            videoType={previewContent.video_type}
            pdfUrl={previewContent.pdf_url || undefined}
          />
        )}
      </CardContent>
    </Card>
  );
}
