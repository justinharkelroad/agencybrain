import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ElevenLabsRealtimeService } from '@/services/elevenLabsRealtime';
import { HeyGenAvatarService } from '@/services/heygenAvatar';
import { Mic, MicOff, Loader2 } from 'lucide-react';

type Status = 'idle' | 'loading' | 'connected' | 'live' | 'error';

export default function RoleplayBot() {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>('idle');
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string; timestamp: number }>>([]);
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const elevenLabsRef = useRef<ElevenLabsRealtimeService | null>(null);
  const heygenRef = useRef<HeyGenAvatarService | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      elevenLabsRef.current?.disconnect();
      heygenRef.current?.cleanup();
    };
  }, []);

  const handleStart = async () => {
    try {
      setStatus('loading');
      
      // Fetch configuration from edge function
      const { data: config, error } = await supabase.functions.invoke('roleplay-config');
      
      if (error || !config) {
        throw new Error('Failed to load configuration');
      }

      // Initialize HeyGen avatar
      if (!avatarContainerRef.current) {
        throw new Error('Avatar container not found');
      }

      heygenRef.current = new HeyGenAvatarService(
        config.heygen.embedToken,
        config.heygen.avatarId
      );
      
      await heygenRef.current.initialize(avatarContainerRef.current);
      
      // Initialize ElevenLabs
      elevenLabsRef.current = new ElevenLabsRealtimeService({
        apiKey: config.elevenlabs.apiKey,
        agentId: config.elevenlabs.agentId,
        voiceId: config.elevenlabs.voiceId,
        onAudioChunk: async (audioData: ArrayBuffer) => {
          // Route audio to HeyGen for lip-sync
          await heygenRef.current?.setAudioInput(audioData);
        },
        onTranscript: (role: string, text: string) => {
          setTranscript(prev => [...prev, { role, text, timestamp: Date.now() }]);
        },
        onStatusChange: (newStatus: string) => {
          if (newStatus === 'connected') setStatus('connected');
          if (newStatus === 'live') setStatus('live');
        },
        onError: (error: Error) => {
          console.error('ElevenLabs error:', error);
          toast({
            title: 'Connection Error',
            description: error.message,
            variant: 'destructive',
          });
          setStatus('error');
        }
      });

      await elevenLabsRef.current.connect();
      
      toast({
        title: 'Connected',
        description: 'Roleplay session is now live. Start speaking!',
      });

    } catch (error) {
      console.error('Failed to start session:', error);
      setStatus('error');
      toast({
        title: 'Failed to Start',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleStop = async () => {
    try {
      elevenLabsRef.current?.disconnect();
      heygenRef.current?.cleanup();
      
      setStatus('idle');
      
      toast({
        title: 'Session Ended',
        description: 'Roleplay session has been stopped.',
      });
    } catch (error) {
      console.error('Error stopping session:', error);
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle': return 'Ready to start';
      case 'loading': return 'Initializing...';
      case 'connected': return 'Connected';
      case 'live': return 'Live - Speak now';
      case 'error': return 'Error occurred';
      default: return 'Unknown';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'idle': return 'text-muted-foreground';
      case 'loading': return 'text-primary animate-pulse';
      case 'connected': return 'text-primary';
      case 'live': return 'text-green-500';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sales Roleplay Trainer</h1>
            <p className="text-muted-foreground mt-1">
              Practice your sales skills with an AI prospect
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
          {/* Avatar Container */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div
                ref={avatarContainerRef}
                className="w-full aspect-video bg-black rounded-lg flex items-center justify-center"
              >
                {status === 'idle' && (
                  <p className="text-white/60">Avatar will appear here</p>
                )}
                {status === 'loading' && (
                  <div className="flex items-center gap-2 text-white">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p>Loading avatar...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Control Panel */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <span className={`text-sm font-semibold ${getStatusColor()}`}>
                    {getStatusText()}
                  </span>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleStart}
                    disabled={status !== 'idle'}
                    className="w-full"
                    size="lg"
                  >
                    {status === 'loading' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-2" />
                        Start Session
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleStop}
                    disabled={status === 'idle'}
                    variant="destructive"
                    className="w-full"
                    size="lg"
                  >
                    <MicOff className="h-4 w-4 mr-2" />
                    End Session
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Transcript Display */}
            {transcript.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-sm font-semibold mb-3">Transcript</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {transcript.map((entry, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium">
                          {entry.role === 'user' ? 'You' : 'Prospect'}:
                        </span>{' '}
                        <span className="text-muted-foreground">{entry.text}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Instructions */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-2">How to use:</h3>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Click "Start Session" to initialize the AI prospect and avatar</li>
              <li>Allow microphone access when prompted</li>
              <li>Begin the conversation with: "Ring ring, let's do a quote in [STATE]"</li>
              <li>Practice your sales pitch with the AI prospect</li>
              <li>Click "End Session" when finished</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
