interface VideoEmbedProps {
  url: string;
  platform: 'youtube' | 'vimeo' | 'loom' | string | null;
  className?: string;
}

/**
 * Renders an embedded video from YouTube, Vimeo, Loom, or a direct video URL.
 * Automatically converts share URLs to embed URLs.
 */
export function VideoEmbed({ url, platform, className = '' }: VideoEmbedProps) {
  if (!url) return null;

  const containerClass = `aspect-video bg-muted rounded-lg overflow-hidden ${className}`;

  switch (platform) {
    case 'youtube': {
      // Convert watch URLs and youtu.be URLs to embed URLs
      let embedUrl = url;
      if (url.includes('watch?v=')) {
        embedUrl = url.replace('watch?v=', 'embed/');
      } else if (url.includes('youtu.be/')) {
        embedUrl = url.replace('youtu.be/', 'www.youtube.com/embed/');
      }
      return (
        <div className={containerClass}>
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    case 'vimeo': {
      return (
        <div className={containerClass}>
          <iframe
            src={url}
            className="w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    case 'loom': {
      // Convert share URLs to embed URLs
      const embedUrl = url.replace('loom.com/share/', 'loom.com/embed/');
      return (
        <div className={containerClass}>
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allowFullScreen
          />
        </div>
      );
    }

    default: {
      // Direct video URL
      return (
        <div className={containerClass}>
          <video
            src={url}
            controls
            className="w-full h-full"
          />
        </div>
      );
    }
  }
}
