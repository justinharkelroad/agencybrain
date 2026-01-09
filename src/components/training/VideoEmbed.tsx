import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface VideoEmbedProps {
  url: string;
  className?: string;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
}

type VideoPlatform = "youtube" | "vimeo" | "loom" | "wistia" | "unknown";

interface VideoData {
  platform: VideoPlatform;
  embedUrl: string;
  videoId: string;
}

export function VideoEmbed({ url, className = "", autoplay = false, muted = false, controls = true }: VideoEmbedProps) {
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!url) {
      setError("No URL provided");
      return;
    }

    try {
      const parsed = parseVideoUrl(url, { autoplay, muted, controls });
      if (parsed.platform === "unknown") {
        setError("Unsupported video platform. Please use YouTube, Vimeo, Loom, or Wistia.");
      } else {
        setVideoData(parsed);
        setError("");
      }
    } catch (err) {
      setError("Invalid video URL format");
      setVideoData(null);
    }
  }, [url, autoplay, muted, controls]);

  if (error) {
    return (
      <Card className="p-4 bg-destructive/10 border-destructive/20">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    );
  }

  if (!videoData) {
    return (
      <div className="aspect-video bg-muted animate-pulse rounded-lg" />
    );
  }

  return (
    <div className={`aspect-video rounded-lg overflow-hidden bg-black ${className}`}>
      <iframe
        src={videoData.embedUrl}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={`${videoData.platform} video player`}
      />
    </div>
  );
}

interface EmbedOptions {
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
}

function buildQueryParams(options: EmbedOptions, platform: VideoPlatform): string {
  const params: string[] = [];
  
  if (platform === "vimeo") {
    if (options.autoplay) params.push("autoplay=1");
    if (options.muted) params.push("muted=1");
    if (options.controls === false) params.push("controls=0");
  } else if (platform === "youtube") {
    if (options.autoplay) params.push("autoplay=1");
    if (options.muted) params.push("mute=1");
    if (options.controls === false) params.push("controls=0");
  } else if (platform === "loom") {
    if (options.autoplay) params.push("autoplay=1");
    if (options.muted) params.push("muted=1");
  }
  
  return params.length > 0 ? `?${params.join("&")}` : "";
}

function parseVideoUrl(url: string, options: EmbedOptions = {}): VideoData {
  const urlLower = url.toLowerCase();

  // YouTube
  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) {
    const videoId = extractYouTubeId(url);
    if (videoId) {
      const queryParams = buildQueryParams(options, "youtube");
      return {
        platform: "youtube",
        videoId,
        embedUrl: `https://www.youtube.com/embed/${videoId}${queryParams}`,
      };
    }
  }

  // Vimeo
  if (urlLower.includes("vimeo.com")) {
    const videoId = extractVimeoId(url);
    if (videoId) {
      const queryParams = buildQueryParams(options, "vimeo");
      return {
        platform: "vimeo",
        videoId,
        embedUrl: `https://player.vimeo.com/video/${videoId}${queryParams}`,
      };
    }
  }

  // Loom
  if (urlLower.includes("loom.com")) {
    const videoId = extractLoomId(url);
    if (videoId) {
      const queryParams = buildQueryParams(options, "loom");
      return {
        platform: "loom",
        videoId,
        embedUrl: `https://www.loom.com/embed/${videoId}${queryParams}`,
      };
    }
  }

  // Wistia
  if (urlLower.includes("wistia.com")) {
    const videoId = extractWistiaId(url);
    if (videoId) {
      return {
        platform: "wistia",
        videoId,
        embedUrl: `https://fast.wistia.net/embed/iframe/${videoId}`,
      };
    }
  }

  return {
    platform: "unknown",
    videoId: "",
    embedUrl: "",
  };
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

function extractLoomId(url: string): string | null {
  const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function extractWistiaId(url: string): string | null {
  const match = url.match(/wistia\.com\/medias\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}
