import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Play, Pause, Volume2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  description: string;
  accent: string;
}

const voices: Voice[] = [
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', gender: 'female', description: 'Warm and expressive', accent: 'American' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', gender: 'male', description: 'Deep and authoritative', accent: 'British' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', description: 'Clear and calming', accent: 'American' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male', description: 'Professional and confident', accent: 'British' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', gender: 'male', description: 'Energetic and motivational', accent: 'American' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', gender: 'female', description: 'Gentle and soothing', accent: 'British' },
];

interface ThetaVoiceStudioSelectorProps {
  selectedVoice: string | null;
  onVoiceSelect: (voiceId: string) => void;
  onContinue: () => void;
}

export function ThetaVoiceStudioSelector({ 
  selectedVoice, 
  onVoiceSelect,
  onContinue 
}: ThetaVoiceStudioSelectorProps) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());

  const handlePlaySample = async (voiceId: string) => {
    try {
      // If this voice is already playing, pause it
      if (playingVoice === voiceId) {
        const audio = audioElements.get(voiceId);
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
        setPlayingVoice(null);
        return;
      }

      // Stop any currently playing audio
      if (playingVoice) {
        const audio = audioElements.get(playingVoice);
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      }

      // Check if we already have cached audio for this voice
      const cachedAudio = audioElements.get(voiceId);
      if (cachedAudio) {
        cachedAudio.play();
        setPlayingVoice(voiceId);
        return;
      }

      // Generate new sample
      setLoadingVoice(voiceId);
      
      const { data, error } = await supabase.functions.invoke('generate_voice_sample', {
        body: { voiceId }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Create audio element
      const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
      audio.onended = () => setPlayingVoice(null);
      
      // Cache the audio element
      const newAudioElements = new Map(audioElements);
      newAudioElements.set(voiceId, audio);
      setAudioElements(newAudioElements);

      // Play the sample
      await audio.play();
      setPlayingVoice(voiceId);
      
    } catch (error) {
      console.error('Error playing voice sample:', error);
      toast.error('Failed to play voice sample');
      setPlayingVoice(null);
    } finally {
      setLoadingVoice(null);
    }
  };

  const handleContinue = () => {
    if (!selectedVoice) {
      toast.error('Please select a voice before continuing');
      return;
    }
    onContinue();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choose Your Voice Narrator</h3>
        <p className="text-sm text-muted-foreground">
          Select the voice that will narrate your personalized affirmations
        </p>
      </div>

      <RadioGroup value={selectedVoice || ''} onValueChange={onVoiceSelect}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {voices.map((voice) => {
            const isSelected = selectedVoice === voice.id;
            const isPlaying = playingVoice === voice.id;
            const isLoading = loadingVoice === voice.id;
            
            return (
              <Label
                key={voice.id}
                htmlFor={voice.id}
                className="cursor-pointer"
              >
                <Card
                  className={`
                    transition-all duration-200 relative
                    ${isSelected 
                      ? 'border-2 border-primary bg-primary/5' 
                      : 'border hover:border-border/60'
                    }
                  `}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                  
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3 mb-3">
                      <RadioGroupItem
                        value={voice.id}
                        id={voice.id}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-semibold">{voice.name}</span>
                          <Badge 
                            variant="outline" 
                            className={
                              voice.gender === 'male' 
                                ? 'bg-blue-500/10 text-blue-700 border-blue-500/20' 
                                : 'bg-pink-500/10 text-pink-700 border-pink-500/20'
                            }
                          >
                            {voice.gender === 'male' ? '♂' : '♀'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {voice.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {voice.accent} accent
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePlaySample(voice.id);
                      }}
                      disabled={isLoading}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {isLoading ? (
                        <>
                          <Volume2 className="h-4 w-4 mr-2 animate-pulse" />
                          Loading...
                        </>
                      ) : isPlaying ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Stop Sample
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Play Sample
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </Label>
            );
          })}
        </div>
      </RadioGroup>

      <div className="flex justify-end">
        <Button
          onClick={handleContinue}
          size="lg"
          disabled={!selectedVoice}
          className="min-w-[200px]"
        >
          Continue to Binaural Composer
        </Button>
      </div>
    </div>
  );
}
