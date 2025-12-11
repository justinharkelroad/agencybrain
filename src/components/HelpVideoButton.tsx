import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { helpVideos } from '@/config/helpVideos';
import { useState } from 'react';
import { HelpVideoModal } from './HelpVideoModal';

interface HelpVideoButtonProps {
  videoKey: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function HelpVideoButton({ videoKey, size = 'sm', className }: HelpVideoButtonProps) {
  const [open, setOpen] = useState(false);
  const video = helpVideos[videoKey];
  
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
        type={video.type}
      />
    </>
  );
}
