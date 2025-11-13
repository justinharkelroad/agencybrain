import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Music, Radio, Download, AlertCircle } from "lucide-react";
import { useGenerateThetaTrack, useGetTrackStatus } from "@/hooks/useThetaTrack";
import { toast } from "sonner";

interface ThetaBinauralComposerProps {
  sessionId: string;
  voiceId: string;
  affirmations: any;
}

export function ThetaBinauralComposer({
  sessionId,
  voiceId,
  affirmations
}: ThetaBinauralComposerProps) {
  const [trackId, setTrackId] = useState<string | null>(null);
  const generateMutation = useGenerateThetaTrack();
  const { data: trackStatus, refetch } = useGetTrackStatus(trackId);

  // Poll for status updates
  useEffect(() => {
    if (trackId && trackStatus?.status === 'generating') {
      const interval = setInterval(() => {
        refetch();
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    }
  }, [trackId, trackStatus?.status, refetch]);

  const handleGenerate = async () => {
    try {
      const result = await generateMutation.mutateAsync({
        sessionId,
        voiceId,
        affirmations
      });
      setTrackId(result.trackId);
      toast.success('Track generation started!');
    } catch (error) {
      console.error('Generation failed:', error);
    }
  };

  const getStatusDisplay = () => {
    if (!trackStatus) return null;

    switch (trackStatus.status) {
      case 'pending':
        return (
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <h3 className="text-lg font-semibold">Initializing...</h3>
            <p className="text-sm text-muted-foreground">
              Preparing your theta track generation
            </p>
          </div>
        );
      case 'generating':
        return (
          <div className="text-center space-y-4">
            <div className="relative">
              <Radio className="h-16 w-16 mx-auto text-primary animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-20 w-20 border-4 border-primary/20 rounded-full animate-ping" />
              </div>
            </div>
            <h3 className="text-lg font-semibold">Generating Your Theta Track</h3>
            <div className="space-y-2 max-w-md mx-auto">
              <div className="flex items-center space-x-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Narrating affirmations with AI voice</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating theta binaural beats (4-8 Hz)</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Music className="h-4 w-4" />
                <span>Mixing audio layers...</span>
              </div>
            </div>
            <Progress value={60} className="w-64 mx-auto" />
            <p className="text-xs text-muted-foreground">
              This may take 2-3 minutes. Creating your personalized 21-minute track...
            </p>
          </div>
        );
      case 'completed':
        return (
          <div className="text-center space-y-4">
            <div className="relative">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-600">Track Ready!</h3>
            <p className="text-sm text-muted-foreground">
              Your personalized theta brainwave track is ready to download
            </p>
            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
              Duration: 21 minutes
            </Badge>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => window.open(trackStatus.audio_url, '_blank')}
                size="lg"
                className="gap-2"
              >
                <Download className="h-5 w-5" />
                Download Track
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  const audio = new Audio(trackStatus.audio_url);
                  audio.play();
                }}
              >
                Preview
              </Button>
            </div>
          </div>
        );
      case 'failed':
        return (
          <div className="text-center space-y-4">
            <AlertCircle className="h-16 w-16 mx-auto text-red-600" />
            <h3 className="text-lg font-semibold text-red-600">Generation Failed</h3>
            <p className="text-sm text-muted-foreground">
              {trackStatus.error_message || 'An error occurred during generation'}
            </p>
            <Button onClick={handleGenerate} variant="outline">
              Try Again
            </Button>
          </div>
        );
    }
  };

  if (trackId && trackStatus) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8">
          {getStatusDisplay()}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Radio className="h-6 w-6" />
          <span>Binaural Composer</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <h4 className="font-semibold flex items-center space-x-2">
              <Music className="h-5 w-5 text-primary" />
              <span>What We'll Create:</span>
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start space-x-2">
                <span className="text-primary">•</span>
                <span>21-minute theta brainwave audio track (4-8 Hz binaural beats)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-primary">•</span>
                <span>Your 20 personalized affirmations narrated in {voiceId ? 'your selected voice' : 'AI voice'}</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-primary">•</span>
                <span>Professionally mixed audio optimized for meditation and subconscious programming</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-primary">•</span>
                <span>Download-ready MP3 file for daily listening</span>
              </li>
            </ul>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <strong>Tip:</strong> Listen to your theta track daily for 21 days with headphones for optimal results. 
              Best used during meditation, visualization, or before sleep.
            </p>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          size="lg"
          className="w-full"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Starting Generation...
            </>
          ) : (
            <>
              <Radio className="h-5 w-5 mr-2" />
              Generate My Theta Track
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
