import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  const [status, setStatus] = useState<'loading' | 'mixing' | 'ready' | 'error'>('loading');
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

      setProgress(30);

      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Decode background track
      const bgArrayBuffer = await bgData.arrayBuffer();
      const backgroundBuffer = await audioContext.decodeAudioData(bgArrayBuffer);

      setProgress(50);
      setStatus('mixing');

      // Decode all affirmation segments first
      const affirmationBuffers: AudioBuffer[] = [];
      for (let i = 0; i < segments.length; i++) {
        const arrayBuffer = base64ToArrayBuffer(segments[i].audio_base64);
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        affirmationBuffers.push(audioBuffer);
        setProgress(50 + (i / segments.length) * 20);
      }

      setProgress(70);

      // Create MediaStreamDestination for recording
      const destination = audioContext.createMediaStreamDestination();

      // Setup background track
      const bgSource = audioContext.createBufferSource();
      bgSource.buffer = backgroundBuffer;
      const bgGain = audioContext.createGain();
      bgGain.gain.value = 0.6; // Reduce background volume
      bgSource.connect(bgGain);
      bgGain.connect(destination);
      bgSource.start(0);

      // Schedule affirmations at intervals
      const duration = 21 * 60; // 21 minutes
      const segmentSpacing = duration / segments.length; // ~63 seconds

      for (let i = 0; i < affirmationBuffers.length; i++) {
        const source = audioContext.createBufferSource();
        source.buffer = affirmationBuffers[i];
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1.0;
        source.connect(gainNode);
        gainNode.connect(destination);
        source.start(audioContext.currentTime + i * segmentSpacing);
      }

      setProgress(80);

      // Use MediaRecorder to capture compressed audio
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setMixedAudioUrl(url);
        setProgress(100);
        setStatus('ready');
        audioContext.close();
        toast.success('Audio track ready for download! (~15 MB)');
      };

      mediaRecorder.start();
      setProgress(85);

      // Stop recording after 21 minutes
      setTimeout(() => {
        mediaRecorder.stop();
        bgSource.stop();
      }, (duration + 1) * 1000); // +1 second buffer

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
    a.download = `theta-track-${trackId}.webm`;
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
              21-minute personalized theta binaural beats with your affirmations (~15 MB)
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
            {status === 'loading' ? 'Loading Audio...' : 'Mixing Your Track...'}
          </h3>
          <p className="text-muted-foreground text-sm mt-2">
            This will take about 21 minutes. Please keep this tab open.
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
