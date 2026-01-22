import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface LaptopVideoFrameProps {
  videoUrl: string;
  className?: string;
}

export function LaptopVideoFrame({ videoUrl, className = '' }: LaptopVideoFrameProps) {
  const [isMuted, setIsMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Extract Vimeo video ID from URL
  const getVimeoEmbedUrl = (url: string) => {
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (match) {
      const videoId = match[1];
      return `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=${isMuted ? 1 : 0}&loop=1&background=0&autopause=0&player_id=0&app_id=58479`;
    }
    return url;
  };

  const embedUrl = getVimeoEmbedUrl(videoUrl);

  // Handle mute toggle - need to reload iframe with new muted parameter
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Laptop Frame Container */}
      <div className="relative mx-auto w-full max-w-3xl">
        {/* Screen bezel */}
        <div className="relative rounded-t-xl bg-gradient-to-b from-zinc-700 to-zinc-800 p-2 shadow-2xl">
          {/* Browser chrome */}
          <div className="flex items-center gap-1.5 rounded-t-lg bg-zinc-900 px-3 py-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
            <div className="ml-4 flex-1 rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-500 truncate">
              agencybrain.lovable.app
            </div>
          </div>
          
          {/* Video container */}
          <div className="relative aspect-video w-full overflow-hidden rounded-b-lg bg-black">
            <iframe
              ref={iframeRef}
              key={isMuted ? 'muted' : 'unmuted'} // Force reload on mute toggle
              src={embedUrl}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
              allowFullScreen
              title="AgencyBrain Demo Video"
            />
            
            {/* Mute/Unmute button overlay */}
            <button
              onClick={toggleMute}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-sm text-white backdrop-blur-sm transition-all hover:bg-black/90 hover:scale-105"
              aria-label={isMuted ? 'Unmute video' : 'Mute video'}
            >
              {isMuted ? (
                <>
                  <VolumeX className="h-4 w-4" />
                  <span className="hidden sm:inline">Click to unmute</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Mute</span>
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Laptop base/keyboard */}
        <div className="relative mx-auto h-4 w-[85%] rounded-b-xl bg-gradient-to-b from-zinc-700 to-zinc-600 shadow-lg">
          {/* Notch */}
          <div className="absolute left-1/2 top-0 h-1 w-16 -translate-x-1/2 rounded-b-lg bg-zinc-500" />
        </div>
        
        {/* Laptop shadow */}
        <div className="absolute -bottom-4 left-1/2 h-4 w-[70%] -translate-x-1/2 rounded-full bg-black/30 blur-xl" />
      </div>
    </div>
  );
}
