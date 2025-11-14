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

      // Create offline context for mixing (21 minutes at 44.1kHz)
      const duration = 21 * 60; // 21 minutes in seconds
      const offlineContext = new OfflineAudioContext(
        2, // stereo
        duration * audioContext.sampleRate,
        audioContext.sampleRate
      );

      // Add background track
      const bgSource = offlineContext.createBufferSource();
      bgSource.buffer = backgroundBuffer;
      
      // Reduce background volume to 60% to let affirmations stand out
      const bgGain = offlineContext.createGain();
      bgGain.gain.value = 0.6;
      bgSource.connect(bgGain);
      bgGain.connect(offlineContext.destination);
      bgSource.start(0);

      setProgress(60);

      // Decode and overlay affirmations
      const segmentSpacing = duration / segments.length; // ~63 seconds between each

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const arrayBuffer = base64ToArrayBuffer(segment.audio_base64);
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;

        // Affirmations at full volume
        const gainNode = offlineContext.createGain();
        gainNode.gain.value = 1.0;

        source.connect(gainNode);
        gainNode.connect(offlineContext.destination);

        const startTime = i * segmentSpacing;
        source.start(startTime);

        setProgress(60 + (i / segments.length) * 30);
      }

      setProgress(90);

      // Render the mixed audio
      const renderedBuffer = await offlineContext.startRendering();

      setProgress(95);

      // Convert to WAV blob (browsers natively support WAV encoding)
      const wavBlob = bufferToWave(renderedBuffer, renderedBuffer.length);
      const url = URL.createObjectURL(wavBlob);

      setMixedAudioUrl(url);
      setProgress(100);
      setStatus('ready');

      toast.success("Your theta track is ready to download!");

    } catch (error) {
      console.error('Audio mixing error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to mix audio');
      toast.error("Failed to create audio track");
    }
  };

  const bufferToWave = (abuffer: AudioBuffer, len: number): Blob => {
    const numOfChan = abuffer.numberOfChannels;
    const length = len * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let offset = 0;
    let pos = 0;

    // Write WAV header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // Write interleaved data
    for (let i = 0; i < abuffer.numberOfChannels; i++) {
      channels.push(abuffer.getChannelData(i));
    }

    while (pos < len) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][pos]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, sample, true);
        offset += 2;
      }
      pos++;
    }

    return new Blob([buffer], { type: 'audio/wav' });

    function setUint16(data: number) {
      view.setUint16(offset, data, true);
      offset += 2;
    }

    function setUint32(data: number) {
      view.setUint32(offset, data, true);
      offset += 4;
    }
  };

  const handleDownload = () => {
    if (!mixedAudioUrl) return;

    const a = document.createElement('a');
    a.href = mixedAudioUrl;
    a.download = `theta-track-${trackId}.wav`;
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
              21-minute personalized theta binaural beats with your affirmations
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
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            {status === 'loading' ? 'Loading Audio Components...' : 'Mixing Your Track...'}
          </h3>
          <p className="text-muted-foreground text-sm mt-2">
            Combining your personalized affirmations with theta binaural beats
          </p>
        </div>
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
        </div>
      </div>
    </Card>
  );
}
