import { Download, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SmartBackButton } from "@/components/SmartBackButton";

export default function ThetaTalkTrackDownload() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <SmartBackButton />
          <h1 className="text-xl font-semibold">Download Your Track</h1>
          <div className="w-24" /> {/* Spacer */}
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Success Message */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-6 w-6 text-primary" />
                Your Theta Talk Track is Ready!
              </CardTitle>
              <CardDescription>
                Your personalized 21-minute theta brainwave audio track has been generated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4 mb-4">
                <p className="text-sm text-muted-foreground mb-2">Track Details:</p>
                <ul className="text-sm space-y-1">
                  <li>• Duration: 21 minutes</li>
                  <li>• Format: MP3</li>
                  <li>• File Size: ~25 MB</li>
                  <li>• Frequency: Theta waves (4-8 Hz)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Lead Capture Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Get Your Download Link
              </CardTitle>
              <CardDescription>
                Enter your email to receive your track and unlock bonus resources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="space-y-3 pt-4">
                  <div className="flex items-start space-x-2">
                    <Checkbox id="tips" />
                    <label
                      htmlFor="tips"
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Send me productivity tips and mindset strategies
                    </label>
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox id="challenge" />
                    <label
                      htmlFor="challenge"
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      I'm interested in the 30-Day Theta Challenge
                    </label>
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  <Download className="mr-2 h-5 w-5" />
                  Download My Theta Talk Track
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By downloading, you agree to receive occasional emails. Unsubscribe anytime.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
