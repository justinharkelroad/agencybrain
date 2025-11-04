import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useConversation } from "@11labs/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mic, MicOff, ChevronDown, ChevronUp, Download, AlertCircle, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import jsPDF from 'jspdf';
import { IdentityModal } from "@/components/IdentityModal";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface GradingSectionProps {
  section: { key: string; title: string };
  data: {
    summary: string;
    strengths?: string[];
    improvements?: string[];
    lowest_option_presented?: boolean;
  };
}

const GradingSection = ({ section, data }: GradingSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible key={section.key} open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <h4 className="font-semibold text-foreground">{section.title}</h4>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-3">
        {/* Summary */}
        <p className="text-sm text-muted-foreground">{data.summary}</p>

        {/* Strengths */}
        {data.strengths?.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Strengths
            </h5>
            <ul className="space-y-1">
              {data.strengths.map((strength: string, idx: number) => (
                <li key={idx} className="text-sm text-foreground pl-6 relative">
                  <span className="absolute left-0 top-1 text-green-600 dark:text-green-400">•</span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvements */}
        {data.improvements?.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Improvements
            </h5>
            <ul className="space-y-1">
              {data.improvements.map((improvement: string, idx: number) => (
                <li key={idx} className="text-sm text-foreground pl-6 relative">
                  <span className="absolute left-0 top-1 text-amber-600 dark:text-amber-400">•</span>
                  {improvement}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Special Lever Pulls indicator */}
        {section.key === 'lever_pulls' && data.lowest_option_presented !== undefined && (
          <Badge variant={data.lowest_option_presented ? "default" : "destructive"} className="mt-2">
            Lowest State-Minimum Option: {data.lowest_option_presented ? 'Presented' : 'Not Presented'}
          </Badge>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default function RoleplayStaff() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');
  
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [staffName, setStaffName] = useState<string>("");
  const [isSubmittingIdentity, setIsSubmittingIdentity] = useState(false);
  
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingReport, setGradingReport] = useState<any>(null);
  const [showGrading, setShowGrading] = useState(false);
  const [hasBeenGraded, setHasBeenGraded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs');
      toast.success("Roleplay session started. Start speaking!");
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs');
      toast.success("Roleplay session ended.");
    },
    onError: (error) => {
      console.error('ElevenLabs error:', error);
      toast.error(typeof error === 'string' ? error : "An error occurred with the voice session.");
    },
    onMessage: (message) => {
      console.log('Message:', message);
      
      // Add message to transcript
      if (message.message && typeof message.message === 'string') {
        const role = message.source === 'ai' ? 'assistant' : 'user';
        setMessages(prev => [...prev, {
          role,
          content: message.message,
          timestamp: new Date()
        }]);
      }
    },
  });

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!token) {
      toast.error("No access token provided");
      setIsValidating(false);
      return;
    }

    validateToken();

    // Fetch signed URL
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('roleplay-config');
        
        if (error) throw error;
        
        if (data?.signedUrl) {
          setSignedUrl(data.signedUrl);
        } else {
          throw new Error('No signed URL received');
        }
      } catch (error: any) {
        console.error('Failed to fetch configuration:', error);
        toast.error(error.message || "Failed to load roleplay configuration.");
      }
    };

    fetchConfig();

    // Invalidate token on page unload
    const handleBeforeUnload = () => {
      if (token && !gradingReport) {
        navigator.sendBeacon(
          `${window.location.origin}/functions/v1/invalidate-roleplay-token`,
          JSON.stringify({ token, reason: 'refresh' })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('validate-roleplay-token', {
        body: { token }
      });

      if (error || !data?.valid) {
        toast.error(data?.error || "Invalid or expired access link");
        setTokenValid(false);
      } else {
        setTokenValid(true);
        if (data.requires_identity) {
          setShowIdentityModal(true);
        }
      }
    } catch (error) {
      console.error("Token validation error:", error);
      toast.error("Failed to validate access link");
      setTokenValid(false);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmitIdentity = async (name: string, email: string) => {
    setIsSubmittingIdentity(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-staff-identity', {
        body: { token, staff_name: name, staff_email: email, session_id: sessionId }
      });

      if (error) {
        toast.error("Failed to submit information");
        return;
      }

      setStaffName(name);
      setShowIdentityModal(false);
      toast.success(`Welcome, ${name}!`);
    } catch (error) {
      console.error("Identity submission error:", error);
      toast.error("An error occurred");
    } finally {
      setIsSubmittingIdentity(false);
    }
  };

  const handleStart = async () => {
    if (!signedUrl) {
      toast.error("Configuration still loading, please wait...");
      return;
    }

    setIsLoading(true);
    try {
      // Clear previous messages and grading state
      setMessages([]);
      setHasBeenGraded(false);
      setGradingReport(null);
      setShowGrading(false);
      
      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Start the conversation with the signed URL
      await conversation.startSession({ signedUrl });
    } catch (error: any) {
      console.error('Failed to start session:', error);
      toast.error(typeof error === 'string' ? error : (error?.message || "Failed to start roleplay session."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      await conversation.endSession();
    } catch (error: any) {
      console.error('Failed to stop session:', error);
      toast.error("Failed to stop session gracefully.");
    }
  };

  const handleGrade = async () => {
    setIsGrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('grade-roleplay', {
        body: { messages }
      });
      
      if (error) throw error;
      
      setGradingReport(data);
      setShowGrading(true);
      setHasBeenGraded(true);
      
      toast.success("Your performance has been analyzed.");
    } catch (error: any) {
      console.error('Grading error:', error);
      
      let errorMessage = "Failed to grade the conversation. Please try again.";
      
      // Parse specific error messages from the response
      if (error?.message) {
        if (error.message.includes('Rate limit exceeded') || error.message.includes('429')) {
          errorMessage = "Rate limit exceeded. Please wait and try again.";
        } else if (error.message.includes('AI credits exhausted') || error.message.includes('402')) {
          errorMessage = "AI credits exhausted. Please add credits to your workspace.";
        } else if (error.message.includes('unauthorized') || error.message.includes('not configured') || error.message.includes('401')) {
          errorMessage = "AI is not configured yet. Please try again shortly.";
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsGrading(false);
    }
  };

  const handleExportPDF = () => {
    if (!gradingReport) return;
    
    const doc = new jsPDF();
    let yPosition = 20;
    
    // Title
    doc.setFontSize(20);
    doc.text('Sales Roleplay Grading Report', 20, yPosition);
    yPosition += 15;
    
    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPosition);
    if (staffName) {
      yPosition += 7;
      doc.text(`Staff: ${staffName}`, 20, yPosition);
    }
    yPosition += 15;
    
    // Overall Score
    doc.setFontSize(14);
    doc.text(`Overall Score: ${gradingReport.overall_score}`, 20, yPosition);
    yPosition += 15;
    
    // Each section
    const sections = [
      { key: 'information_verification', title: 'Information Verification' },
      { key: 'rapport', title: 'Rapport' },
      { key: 'coverage_conversation', title: 'Coverage Conversation' },
      { key: 'wrap_up', title: 'Wrap Up' },
      { key: 'lever_pulls', title: 'Lever Pulls' }
    ];
    
    sections.forEach(section => {
      const data = gradingReport[section.key];
      
      // Section title
      doc.setFontSize(12);
      doc.text(section.title, 20, yPosition);
      yPosition += 8;
      
      // Summary
      doc.setFontSize(10);
      const summaryLines = doc.splitTextToSize(data.summary, 170);
      doc.text(summaryLines, 25, yPosition);
      yPosition += summaryLines.length * 5 + 5;
      
      // Strengths
      if (data.strengths?.length > 0) {
        doc.text('Strengths:', 25, yPosition);
        yPosition += 5;
        data.strengths.forEach((strength: string) => {
          const lines = doc.splitTextToSize(`• ${strength}`, 165);
          doc.text(lines, 30, yPosition);
          yPosition += lines.length * 5;
        });
        yPosition += 3;
      }
      
      // Improvements
      if (data.improvements?.length > 0) {
        doc.text('Improvements:', 25, yPosition);
        yPosition += 5;
        data.improvements.forEach((improvement: string) => {
          const lines = doc.splitTextToSize(`• ${improvement}`, 165);
          doc.text(lines, 30, yPosition);
          yPosition += lines.length * 5;
        });
        yPosition += 3;
      }
      
      // Page break if needed
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      
      yPosition += 5;
    });
    
    // Special callout for lowest option
    if (gradingReport.lever_pulls?.lowest_option_presented !== undefined) {
      doc.setFontSize(11);
      const presented = gradingReport.lever_pulls.lowest_option_presented ? 'YES' : 'NO';
      doc.text(`Lowest State-Minimum Option Presented: ${presented}`, 20, yPosition);
    }
    
    // Save
    doc.save(`roleplay-grade-${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast.success("Your grading report has been downloaded.");
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Validating access link...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              This access link is invalid or has expired. Please request a new link from your manager.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const isConnected = conversation.status === 'connected';

  return (
    <>
      <IdentityModal 
        open={showIdentityModal}
        onSubmit={handleSubmitIdentity}
        isSubmitting={isSubmittingIdentity}
      />

      <div className="min-h-screen bg-background p-6">
        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <h1 className="text-4xl font-bold text-foreground">Sales Roleplay Trainer</h1>
          <p className="text-muted-foreground">Practice your sales pitch with an AI prospect</p>
          {staffName && (
            <Badge variant="outline" className="mt-2">Staff: {staffName}</Badge>
          )}
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Card */}
            <Card className="p-8">
            <div className="space-y-6">
              {/* Avatar Container - ElevenLabs widget will render here */}
              <div className="flex justify-center items-center min-h-[250px] bg-muted/30 rounded-lg">
                {isConnected ? (
                  <div className="flex flex-col items-center gap-4">
                    {conversation.isSpeaking ? (
                      <div className="flex items-center gap-2 text-primary">
                        <Mic className="h-6 w-6 animate-pulse" />
                        <span className="text-sm font-medium">AI is speaking...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MicOff className="h-6 w-6" />
                        <span className="text-sm font-medium">Listening...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="w-32 h-32 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                      <Mic className="h-16 w-16 text-primary/50" />
                    </div>
                    <p className="text-muted-foreground">Click "Start Session" to begin</p>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex justify-center gap-4">
                {!isConnected ? (
                  <Button
                    onClick={handleStart}
                    disabled={isLoading || !signedUrl}
                    size="lg"
                    className="gap-2"
                  >
                    <Mic className="h-5 w-5" />
                    {isLoading ? 'Starting...' : 'Start Session'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleStop}
                    variant="destructive"
                    size="lg"
                    className="gap-2"
                  >
                    <MicOff className="h-5 w-5" />
                    End Session
                  </Button>
                )}
              </div>

              {/* Status */}
              <div className="text-center">
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  isConnected 
                    ? 'bg-green-500/10 text-green-700 dark:text-green-400' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'
                  }`} />
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </Card>

          {/* Conversation Transcript */}
          {messages.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Conversation</h3>
              <ScrollArea className="h-[400px] pr-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((message, idx) => (
                    <div
                      key={idx}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        <p className="text-xs font-semibold mb-1 opacity-70">
                          {message.role === 'user' ? 'You' : 'AI Prospect'}
                        </p>
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-60 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>

        {/* Right Sidebar - Controls & Info */}
        <div className="space-y-6">
          {/* Session Info */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Session Info</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={isConnected ? "default" : "secondary"}>
                  {isConnected ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Messages:</span>
                <span className="font-medium text-foreground">{messages.length}</span>
              </div>
            </div>
          </Card>

          {/* Grade Button */}
          {messages.length > 0 && !isConnected && (
            <Button
              onClick={handleGrade}
              disabled={isGrading || hasBeenGraded}
              className="w-full"
              size="lg"
            >
              {isGrading ? 'Grading...' : hasBeenGraded ? 'Already Graded' : 'Grade My Performance'}
            </Button>
          )}

          {/* Grading Results */}
          {gradingReport && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Performance Report</h3>
                <Button
                  onClick={handleExportPDF}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
              </div>

              {/* Overall Score */}
              {gradingReport.overall_score && (
                <div className="mb-6 p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
                    <p className="text-3xl font-bold text-primary">{gradingReport.overall_score}</p>
                  </div>
                </div>
              )}

              {/* Sections */}
              <div className="space-y-3">
                {[
                  { key: 'information_verification', title: 'Information Verification' },
                  { key: 'rapport', title: 'Rapport' },
                  { key: 'coverage_conversation', title: 'Coverage Conversation' },
                  { key: 'wrap_up', title: 'Wrap Up' },
                  { key: 'lever_pulls', title: 'Lever Pulls' }
                ].map((section) => (
                  <GradingSection
                    key={section.key}
                    section={section}
                    data={gradingReport[section.key]}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Instructions */}
          {!isConnected && messages.length === 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-3 text-foreground">Instructions</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">1.</span>
                  <span>Click "Start Session" to begin the roleplay</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">2.</span>
                  <span>Practice your sales pitch with the AI prospect</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">3.</span>
                  <span>End the session when finished</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">4.</span>
                  <span>Click "Grade My Performance" to get feedback</span>
                </li>
              </ol>
            </Card>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
