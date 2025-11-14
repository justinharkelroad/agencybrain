import { useNavigate } from "react-router-dom";
import { Brain, Waves, Music, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SmartBackButton } from "@/components/SmartBackButton";

export default function ThetaTalkTrack() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <SmartBackButton />
          <h1 className="text-xl font-semibold">Theta Talk Track</h1>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <Brain className="h-16 w-16 mx-auto mb-4 text-primary" />
          <h2 className="text-4xl font-bold mb-4">
            Your Personalized 21-Minute Theta Brainwave Track
          </h2>
          <p className="text-xl text-muted-foreground">
            Transform your mindset with AI-powered affirmations set to theta brainwave frequencies
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader>
              <Waves className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Theta Frequencies</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Scientifically-designed binaural beats at 4-8 Hz to access your subconscious mind
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Brain className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>AI Affirmations</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Custom affirmations generated for your Body, Being, Balance, and Business goals
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Music className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Voice Options</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Choose between male and female voices for your personalized audio experience
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  1
                </span>
                <div>
                  <strong>Enter Your Targets:</strong> Define your Body, Being, Balance, and Business goals
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  2
                </span>
                <div>
                  <strong>AI Generates Affirmations:</strong> Our AI creates personalized affirmations based on your targets
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  3
                </span>
                <div>
                  <strong>Choose Your Voice:</strong> Select male or female voice narration
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  4
                </span>
                <div>
                  <strong>Download Your Track:</strong> Get your custom 21-minute theta brainwave audio file so you can manifest them daily.
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center">
          <Button
            size="lg"
            onClick={() => navigate("/theta-talk-track/create")}
            className="bg-primary hover:bg-primary/90"
          >
            <Download className="mr-2 h-5 w-5" />
            Create Your Theta Talk Track
          </Button>
        </div>
      </div>
    </div>
  );
}
