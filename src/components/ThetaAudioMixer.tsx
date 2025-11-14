import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as lamejs from "lamejs";

interface AudioSegment {
  text: string;
  audio_base64: string;
}

interface ThetaAudioMixerProps {
  segments: AudioSegment[];
  backgroundTrackPath: string;
  trackId: string;
}

export function ThetaAudioMixer({ segments, backgroundTrackPath, trackId }: ThetaAudioMixerProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'loading' | 'rendering' | 'encoding' | 'ready' | 'error'>('loading');
  const [mixedAudioUrl, setMixedAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    mixAudio();
  }, [segments, backgroundTrackPath]);

  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const mixAudio = async () => {
    try {
      setStatus('loading');
      setProgress(10);

      // Fetch background track from storage
      const { data: bgData, error: bgError } = await supabase.storage
        .from('binaural-beats')
        .download(backgroundTrackPath);

      if (bgError) throw new Error(`Failed to load background track: ${bgError.message}`);

      setProgress(20);

      // Create temporary audio context for decoding
      const tempContext = new AudioContext();
      
      // Decode background track
      const bgArrayBuffer = await bgData.arrayBuffer();
      const backgroundBuffer = await tempContext.decodeAudioData(bgArrayBuffer);

      setProgress(30);

      // Decode all affirmation segments
      const affirmationBuffers: AudioBuffer[] = [];
      for (let i = 0; i < segments.length; i++) {
        const arrayBuffer = base64ToArrayBuffer(segments[i].audio_base64);
        const audioBuffer = await tempContext.decodeAudioData(arrayBuffer);
        affirmationBuffers.push(audioBuffer);
        setProgress(30 + (i / segments.length) * 20);
      }

      setProgress(50);
      setStatus('rendering');

      // Create OfflineAudioContext for fast rendering
      const sampleRate = 44100;
      const duration = 21 * 60; // 21 minutes
      const offlineContext = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

      // Setup background track
      const bgSource = offlineContext.createBufferSource();
      bgSource.buffer = backgroundBuffer;
      const bgGain = offlineContext.createGain();
      bgGain.gain.value = 0.6;
      bgSource.connect(bgGain);
      bgGain.connect(offlineContext.destination);
      bgSource.start(0);

      // Schedule affirmations at intervals
      const segmentSpacing = duration / segments.length;

      for (let i = 0; i < affirmationBuffers.length; i++) {
        const source = offlineContext.createBufferSource();
        source.buffer = affirmationBuffers[i];
        const gainNode = offlineContext.createGain();
        gainNode.gain.value = 1.0;
        source.connect(gainNode);
        gainNode.connect(offlineContext.destination);
        source.start(i * segmentSpacing);
      }

      setProgress(60);

      // Render the audio (fast, synchronous)
      const renderedBuffer = await offlineContext.startRendering();

      setProgress(70);
      setStatus('encoding');

      // Convert to MP3 using lamejs
      const mp3Encoder = new lamejs.Mp3Encoder(2, sampleRate, 128); // stereo, 44.1kHz, 128kbps
      const mp3Data: Uint8Array[] = [];

      const leftChannel = renderedBuffer.getChannelData(0);
      const rightChannel = renderedBuffer.getChannelData(1);

      // Convert Float32 to Int16
      const left = new Int16Array(leftChannel.length);
      const right = new Int16Array(rightChannel.length);

      for (let i = 0; i < leftChannel.length; i++) {
        left[i] = leftChannel[i] * 32767.5;
        right[i] = rightChannel[i] * 32767.5;
      }

      setProgress(80);

      // Encode in chunks
      const chunkSize = 1152;
      const totalChunks = Math.ceil(left.length / chunkSize);
      
      for (let i = 0; i < left.length; i += chunkSize) {
        const leftChunk = left.subarray(i, i + chunkSize);
        const rightChunk = right.subarray(i, i + chunkSize);
        const mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf));
        
        // Update progress during encoding
        const chunkProgress = Math.floor(i / chunkSize);
        setProgress(80 + (chunkProgress / totalChunks) * 15);
      }

      // Flush remaining data
      const mp3buf = mp3Encoder.flush();
      if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf));

      setProgress(95);

      // Create MP3 Blob
      const mp3Blob = new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' });
      const url = URL.createObjectURL(mp3Blob);
      
      setMixedAudioUrl(url);
      setProgress(100);
      setStatus('ready');
      
      tempContext.close();
      toast.success('MP3 track ready! Works on all devices (~25 MB)');

    } catch (error: any) {
      console.error('Error mixing audio:', error);
      setErrorMessage(error.message || 'Failed to mix audio');
      setStatus('error');
      toast.error('Failed to mix audio track');
    }
  };

  const handleDownload = () => {
    if (!mixedAudioUrl) return;

    const a = document.createElement('a');
    a.href = mixedAudioUrl;
    a.download = `theta-track-${trackId}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    toast.success("Download started!");
  };

  if (status === 'error') {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <p className="text-destructive">Error: {errorMessage}</p>
          <Button onClick={mixAudio} variant="outline">
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  if (status === 'ready' && mixedAudioUrl) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Download className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Your Theta Track is Ready!</h3>
            <p className="text-muted-foreground text-sm mt-2">
              21-minute personalized theta binaural beats with your affirmations (~25 MB MP3)
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              ✅ Works on all devices (iOS, Android, Windows, Mac)
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={handleDownload} size="lg">
              <Download className="w-4 h-4 mr-2" />
              Download Track
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline" size="lg">
              Create Another
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
        <div>
          <h3 className="text-lg font-semibold">
            {status === 'loading' && 'Loading Audio...'}
            {status === 'rendering' && 'Rendering Track...'}
            {status === 'encoding' && 'Encoding MP3...'}
          </h3>
          <p className="text-muted-foreground text-sm mt-2">
            {status === 'loading' && 'Preparing audio files...'}
            {status === 'rendering' && 'Fast synchronous rendering in progress...'}
            {status === 'encoding' && 'Converting to MP3 format (~30 seconds)...'}
          </p>
        </div>
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-muted-foreground">{progress}%</p>
        </div>
      </div>
    </Card>
  );
}
