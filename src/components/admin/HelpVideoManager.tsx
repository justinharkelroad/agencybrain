import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, Trash2, Plus, Video, Play } from 'lucide-react';
import { toast } from 'sonner';
import { HelpVideoModal } from '@/components/HelpVideoModal';

interface HelpVideo {
  id: string;
  video_key: string;
  title: string;
  url: string;
  video_type: 'youtube' | 'loom';
  placement_description: string | null;
  is_active: boolean;
}

export function HelpVideoManager() {
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingVideo, setEditingVideo] = useState<HelpVideo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    video_key: '',
    title: '',
    url: '',
    video_type: 'youtube' as 'youtube' | 'loom',
    placement_description: ''
  });

  const fetchVideos = async () => {
    const { data, error } = await supabase
      .from('help_videos')
      .select('*')
      .order('video_key');
    
    if (error) {
      toast.error('Failed to load videos');
      return;
    }
    setVideos((data || []) as HelpVideo[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const convertToEmbedUrl = (url: string, type: 'youtube' | 'loom'): string => {
    if (!url) return '';
    
    if (type === 'youtube') {
      // Handle various YouTube URL formats
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
      // Handle Loom URLs
      const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
      if (match) {
        return `https://www.loom.com/embed/${match[1]}`;
      }
    }
    return url; // Return as-is if already correct format
  };

  const handleSave = async () => {
    const embedUrl = convertToEmbedUrl(formData.url, formData.video_type);
    
    const payload = {
      video_key: formData.video_key,
      title: formData.title,
      url: embedUrl,
      video_type: formData.video_type,
      placement_description: formData.placement_description || null,
      updated_at: new Date().toISOString()
    };

    if (editingVideo) {
      const { error } = await supabase
        .from('help_videos')
        .update(payload)
        .eq('id', editingVideo.id);
      
      if (error) {
        toast.error('Failed to update video');
        return;
      }
      toast.success('Video updated');
    } else {
      const { error } = await supabase
        .from('help_videos')
        .insert(payload);
      
      if (error) {
        if (error.code === '23505') {
          toast.error('A video with this key already exists');
        } else {
          toast.error('Failed to add video');
        }
        return;
      }
      toast.success('Video added');
    }

    setDialogOpen(false);
    setEditingVideo(null);
    setFormData({ video_key: '', title: '', url: '', video_type: 'youtube', placement_description: '' });
    fetchVideos();
  };

  const handleEdit = (video: HelpVideo) => {
    setEditingVideo(video);
    setFormData({
      video_key: video.video_key,
      title: video.title,
      url: video.url,
      video_type: video.video_type,
      placement_description: video.placement_description || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video? The button will still exist but won\'t show until you add a new URL.')) return;
    
    const { error } = await supabase
      .from('help_videos')
      .update({ url: '', updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to delete video');
      return;
    }
    toast.success('Video removed');
    fetchVideos();
  };

  const handleAddNew = () => {
    setEditingVideo(null);
    setFormData({ video_key: '', title: '', url: '', video_type: 'youtube', placement_description: '' });
    setDialogOpen(true);
  };

  const [previewVideo, setPreviewVideo] = useState<HelpVideo | null>(null);

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
              <Video className="h-5 w-5" />
              Help Videos
            </CardTitle>
            <CardDescription>
              Manage training videos that appear throughout the app
            </CardDescription>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Video
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
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.map((video) => (
              <TableRow key={video.id}>
                <TableCell className="font-mono text-sm">{video.video_key}</TableCell>
                <TableCell>{video.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {video.placement_description || '—'}
                </TableCell>
                <TableCell>
                  {video.url ? (
                    <span className="text-green-600 text-sm">● Active</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">○ No video</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {video.url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30 hover:text-destructive"
                        onClick={() => setPreviewVideo(video)}
                        title={`Preview: ${video.title}`}
                      >
                        <Play className="h-3 w-3" fill="currentColor" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(video)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {video.url && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(video.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingVideo ? 'Edit Video' : 'Add Video'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Video Key</Label>
                <Input
                  value={formData.video_key}
                  onChange={(e) => setFormData({ ...formData, video_key: e.target.value })}
                  placeholder="dashboard-overview"
                  disabled={!!editingVideo}
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
              <div>
                <Label>Video Type</Label>
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
              </div>
              <div>
                <Label>Video URL</Label>
                <Input
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="Paste YouTube or Loom link here"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste any YouTube or Loom link - it will be converted automatically
                </p>
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

        {previewVideo && (
          <HelpVideoModal
            open={!!previewVideo}
            onClose={() => setPreviewVideo(null)}
            title={previewVideo.title}
            url={previewVideo.url}
            type={previewVideo.video_type}
          />
        )}
      </CardContent>
    </Card>
  );
}
