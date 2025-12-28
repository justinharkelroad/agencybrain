import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { SidebarLayout } from "@/components/SidebarLayout";
import { useThetaStore } from "@/lib/thetaTrackStore";
import { ThetaTargetsInput } from "@/components/ThetaTargetsInput";
import { ThetaToneSelector } from "@/components/ThetaToneSelector";
import { ThetaAffirmationsApproval } from "@/components/ThetaAffirmationsApproval";
import { ThetaVoiceStudioSelector } from "@/components/ThetaVoiceStudioSelector";
import { ThetaBinauralComposer } from "@/components/ThetaBinauralComposer";
import { ThetaStartOverDialog } from "@/components/ThetaStartOverDialog";
import { getOrCreateSessionId, clearSessionId } from "@/lib/sessionUtils";
import { useGenerateAffirmations, useSaveAffirmations } from "@/hooks/useThetaAffirmations";
import { toast } from "sonner";

export default function ThetaTalkTrackCreate() {
  const { 
    currentStep, 
    sessionId, 
    setSessionId, 
    setCurrentStep,
    targets,
    affirmations,
    setAffirmations,
    selectedVoice,
    setSelectedVoice,
    resetSession
  } = useThetaStore();
  
  const [selectedTone, setSelectedTone] = useState('inspiring');
  const [generatedAffirmations, setGeneratedAffirmations] = useState<any>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  
  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const generateMutation = useGenerateAffirmations();
  const saveMutation = useSaveAffirmations();

  useEffect(() => {
    if (!sessionId) {
      setSessionId(getOrCreateSessionId());
    }
  }, [sessionId, setSessionId]);

  const handleGenerateAffirmations = async () => {
    try {
      const result = await generateMutation.mutateAsync({
        targets,
        tone: selectedTone
      });
      setGeneratedAffirmations(result);
      toast.success('Affirmations generated successfully!');
    } catch (error) {
      console.error('Generation failed:', error);
    }
  };

  const handleApproveAffirmations = async (approvedAffirmations: any) => {
    try {
      await saveMutation.mutateAsync({
        sessionId,
        affirmations: approvedAffirmations,
        tone: selectedTone as 'inspiring' | 'motivational' | 'calm' | 'energizing'
      });
      setAffirmations(approvedAffirmations);
      setCurrentStep(3);
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleRegenerate = () => {
    setGeneratedAffirmations(null);
  };

  const handleStartOver = () => {
    resetSession();
    clearSessionId();
    setGeneratedAffirmations(null);
    setSelectedTone('inspiring');
    setShowResetDialog(false);
    toast.success('Session reset. Starting over...');
  };

  const handleStartOverClick = () => {
    if (currentStep > 1) {
      setShowResetDialog(true);
    } else {
      handleStartOver();
    }
  };

  const stepTitles = [
    "Enter Your 90 Day Targets",
    "AI-Generated Affirmations",
    "Voice Studio Selection",
    "Binaural Composer"
  ];

  return (
    <SidebarLayout>
      <div className="flex-1 bg-background">
        {/* Header with Start Over button */}
        <header className="border-b border-border">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Create Theta Talk Track</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartOverClick}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Start Over</span>
            </Button>
          </div>
        </header>

        {/* Progress Bar */}
      <div className="border-b border-border bg-muted/30">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                Step {currentStep} of {totalSteps}
              </span>
              <span className="text-sm text-muted-foreground">
                {stepTitles[currentStep - 1]}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>{stepTitles[currentStep - 1]}</CardTitle>
              <CardDescription>
                {currentStep === 1 && "Define your Body, Being, Balance, and Business goals"}
                {currentStep === 2 && "Review and customize your AI-generated affirmations"}
                {currentStep === 3 && "Choose your preferred voice narrator"}
                {currentStep === 4 && "Generate your binaural theta brainwave track"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentStep === 1 && <ThetaTargetsInput />}
              
              {currentStep === 2 && (
                <div className="space-y-6">
                  {!generatedAffirmations ? (
                    <>
                      <ThetaToneSelector
                        selectedTone={selectedTone}
                        onToneChange={setSelectedTone}
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={handleGenerateAffirmations}
                          disabled={generateMutation.isPending}
                          className="px-6 py-2 bg-white text-black border border-gray-200 rounded-md transition-all disabled:opacity-50"
                        >
                          {generateMutation.isPending ? 'Generating...' : 'Generate Affirmations'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <ThetaAffirmationsApproval
                      affirmations={generatedAffirmations}
                      onApprove={handleApproveAffirmations}
                      onRegenerate={handleRegenerate}
                      isRegenerating={generateMutation.isPending}
                    />
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <ThetaVoiceStudioSelector
                  selectedVoice={selectedVoice}
                  onVoiceSelect={setSelectedVoice}
                  onContinue={() => setCurrentStep(4)}
                />
              )}
              {currentStep === 4 && (
                <ThetaBinauralComposer
                  sessionId={sessionId}
                  voiceId={selectedVoice || ''}
                  affirmations={affirmations}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

        <ThetaStartOverDialog
          open={showResetDialog}
          onOpenChange={setShowResetDialog}
          onConfirm={handleStartOver}
        />
      </div>
    </SidebarLayout>
  );
}
