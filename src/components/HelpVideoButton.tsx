import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { HelpVideoModal } from './HelpVideoModal';
import { supabase } from '@/integrations/supabase/client';

interface HelpVideo {
  title: string;
  url: string;
  video_type: 'youtube' | 'loom';
}

interface HelpVideoButtonProps {
  videoKey: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function HelpVideoButton({ videoKey, size = 'sm', className }: HelpVideoButtonProps) {
  const [open, setOpen] = useState(false);
  const [video, setVideo] = useState<HelpVideo | null>(null);

  useEffect(() => {
    const fetchVideo = async () => {
      const { data } = await supabase
        .from('help_videos')
        .select('title, url, video_type')
        .eq('video_key', videoKey)
        .eq('is_active', true)
        .maybeSingle();
      
      // Only set video if it has a URL (not just a placeholder)
      if (data?.url && data.url.trim() !== '') {
        setVideo(data as HelpVideo);
      }
    };
    fetchVideo();
  }, [videoKey]);

  // Don't render if no video or no URL set yet
  if (!video) return null;

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const buttonSize = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={`${buttonSize} rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 ${className}`}
        onClick={() => setOpen(true)}
        title={`Watch: ${video.title}`}
      >
        <Play className={iconSize} fill="currentColor" />
      </Button>

      <HelpVideoModal
        open={open}
        onClose={() => setOpen(false)}
        title={video.title}
        url={video.url}
        type={video.video_type}
      />
    </>
  );
}
