import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useConversation } from '@11labs/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Download, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';

interface Message {
  role: 'user' | 'assistant';
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

const RoleplayStaff = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t') || searchParams.get('token');
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingReport, setGradingReport] = useState<any>(null);
  const [showGrading, setShowGrading] = useState(false);
  const [hasBeenGraded, setHasBeenGraded] = useState(false);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs');
      toast({
        title: "Connected",
        description: "Roleplay session started. Start speaking!",
      });
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs');
      toast({
        title: "Disconnected",
        description: "Roleplay session ended.",
      });
    },
    onError: (error) => {
      console.error('ElevenLabs error:', error);
      toast({
        title: "Error",
        description: typeof error === 'string' ? error : "An error occurred with the voice session.",
        variant: "destructive",
      });
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
    // Fetch signed URL on component mount
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
        toast({
          title: "Configuration Error",
          description: error.message || "Failed to load roleplay configuration.",
          variant: "destructive",
        });
      }
    };

    fetchConfig();
  }, [toast]);

  useEffect(() => {
    // Validate token on mount
    const validateToken = async () => {
      if (!token) {
        setIsValidating(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('validate-roleplay-token', {
          body: { token }
        });

        if (error) throw error;

        if (data.valid) {
          setIsValidated(true);
        } else {
          toast({
            title: "Invalid Link",
            description: "This link is invalid or has expired.",
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error('Token validation error:', error);
        toast({
          title: "Validation Error",
          description: "Failed to validate access link.",
          variant: "destructive",
        });
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token, toast]);

  const handleStart = async () => {
    if (!signedUrl) {
      toast({
        title: "Configuration Missing",
        description: "Please wait for configuration to load.",
        variant: "destructive",
      });
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
      toast({
        title: "Session Error",
        description: typeof error === 'string' ? error : (error?.message || "Failed to start roleplay session."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrade = async () => {
    setIsGrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('grade-roleplay', {
        body: { messages, token }
      });
      
      if (error) throw error;
      
      setGradingReport(data);
      setShowGrading(true);
      setHasBeenGraded(true);
      
      toast({
        title: "Grading Complete",
        description: "Your performance has been analyzed.",
      });
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
      
      toast({
        title: "Grading Failed",
        description: errorMessage,
        variant: "destructive",
      });
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
    
    toast({
      title: "PDF Exported",
      description: "Your grading report has been downloaded.",
    });
  };

  const handleStop = async () => {
    try {
      await conversation.endSession();
    } catch (error: any) {
      console.error('Failed to stop session:', error);
      toast({
        title: "Error",
        description: "Failed to stop session gracefully.",
        variant: "destructive",
      });
    }
  };

  const isConnected = conversation.status === 'connected';

  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Validating access...</p>
        </div>
      </div>
    );
  }

  // Access denied state
  if (!isValidated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground">
            This link is invalid or has expired. Please request a new link from your administrator.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-4xl font-bold text-foreground">Sales Roleplay Trainer</h1>
        <p className="text-muted-foreground">Practice your sales pitch with an AI prospect</p>
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

          {/* Example Flow */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Example Flow To Begin</h2>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-primary mb-1">AI Trainer:</p>
                <p className="text-muted-foreground pl-4">
                  Say "I want to practice in the state of...(insert state)."
                </p>
              </div>
              
              <div>
                <p className="font-medium text-foreground mb-1">Sales Agent:</p>
                <p className="text-muted-foreground pl-4">
                  "I want to practice in the state of Indiana"
                </p>
              </div>
              
              <div>
                <p className="font-medium text-primary mb-1">AI Trainer:</p>
                <p className="text-muted-foreground pl-4">
                  Great, I will play a prospect from the state of Indiana. Let's act like I just said "Hello?"
                </p>
              </div>
              
              <div>
                <p className="font-medium text-foreground mb-1">Sales Agent:</p>
                <p className="text-muted-foreground pl-4">
                  "Hi this is Susie at Allstate. Is this ____?"
                </p>
              </div>
              
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground italic">
                  Continue from there...
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Sidebar - Transcript and Grading */}
        <div className="lg:col-span-1 space-y-6">
          {/* Transcript */}
          {messages.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Conversation Transcript</h2>
              <ScrollArea className="h-[500px] pr-4">
                <div ref={scrollRef} className="space-y-3">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        msg.role === 'assistant'
                          ? 'bg-primary/10 text-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-medium">
                          {msg.role === 'assistant' ? 'AI Trainer' : 'You'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}

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
          {showGrading && gradingReport && (
            <Card className="p-6">
              <div className="space-y-6">
                {/* Overall Score */}
                <div className="text-center pb-4 border-b border-border">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Overall Score</h3>
                  <p className="text-3xl font-bold text-primary">{gradingReport.overall_score}</p>
                </div>

                {/* Sections */}
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

                {/* Export PDF Button */}
                <Button
                  onClick={handleExportPDF}
                  variant="secondary"
                  className="w-full gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export as PDF
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleplayStaff;
