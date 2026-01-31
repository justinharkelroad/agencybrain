import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { HelpModal } from './HelpModal';
import { supabase } from '@/integrations/supabase/client';

interface HelpContent {
  title: string;
  url: string;
  video_type: 'youtube' | 'loom';
  pdf_url: string | null;
}

interface HelpButtonProps {
  videoKey: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function HelpButton({ videoKey, size = 'sm', className }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<HelpContent | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      const { data } = await supabase
        .from('help_videos')
        .select('title, url, video_type, pdf_url')
        .eq('video_key', videoKey)
        .eq('is_active', true)
        .maybeSingle();
      
      // Only set content if it has a video URL OR a PDF URL
      if (data && ((data.url && data.url.trim() !== '') || (data.pdf_url && data.pdf_url.trim() !== ''))) {
        setContent(data as HelpContent);
      }
    };
    fetchContent();
  }, [videoKey]);

  // Don't render if no content available
  if (!content) return null;

  const hasVideo = content.url && content.url.trim() !== '';
  const hasPdf = content.pdf_url && content.pdf_url.trim() !== '';

  // Should have at least one
  if (!hasVideo && !hasPdf) return null;

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const buttonSize = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={`${buttonSize} rounded-full bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary ${className}`}
        onClick={() => setOpen(true)}
        title={`Help: ${content.title}`}
      >
        <HelpCircle className={iconSize} />
      </Button>

      <HelpModal
        open={open}
        onClose={() => setOpen(false)}
        title={content.title}
        videoUrl={hasVideo ? content.url : undefined}
        videoType={content.video_type}
        pdfUrl={hasPdf ? content.pdf_url! : undefined}
      />
    </>
  );
}
