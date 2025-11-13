import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SmartBackButton } from "@/components/SmartBackButton";
import { Progress } from "@/components/ui/progress";
import { useThetaStore } from "@/lib/thetaTrackStore";
import { ThetaTargetsInput } from "@/components/ThetaTargetsInput";
import { getOrCreateSessionId } from "@/lib/sessionUtils";

export default function ThetaTalkTrackCreate() {
  const { currentStep, sessionId, setSessionId } = useThetaStore();
  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  useEffect(() => {
    if (!sessionId) {
      setSessionId(getOrCreateSessionId());
    }
  }, [sessionId, setSessionId]);

  const stepTitles = [
    "Enter Your 4B Targets",
    "AI-Generated Affirmations",
    "Voice Studio Selection",
    "Binaural Composer"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <SmartBackButton />
          <h1 className="text-xl font-semibold">Create Theta Talk Track</h1>
          <div className="w-24" /> {/* Spacer */}
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
                <div className="text-center py-16 text-muted-foreground">
                  AI Affirmations (Gate 3)
                </div>
              )}
              {currentStep === 3 && (
                <div className="text-center py-16 text-muted-foreground">
                  Voice Studio (Gate 4)
                </div>
              )}
              {currentStep === 4 && (
                <div className="text-center py-16 text-muted-foreground">
                  Binaural Composer (Gate 5)
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
