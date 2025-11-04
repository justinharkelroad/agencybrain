import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useConversation } from "@11labs/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Mic, MicOff, ChevronDown, ChevronUp, Download, AlertCircle, Loader2 } from "lucide-react";
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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">{section.title}</h3>
            {section.key === 'lever_pulls' && data?.lowest_option_presented === false && (
              <Badge variant="destructive">Needs Improvement</Badge>
            )}
          </div>
          {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4 space-y-4">
        <div>
          <h4 className="font-medium mb-2">Summary</h4>
          <p className="text-muted-foreground">{data?.summary || 'No summary available'}</p>
        </div>
        {data?.strengths && data.strengths.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 text-green-600">Strengths</h4>
            <ul className="list-disc list-inside space-y-1">
              {data.strengths.map((strength, idx) => (
                <li key={idx} className="text-muted-foreground">{strength}</li>
              ))}
            </ul>
          </div>
        )}
        {data?.improvements && data.improvements.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 text-orange-600">Areas for Improvement</h4>
            <ul className="list-disc list-inside space-y-1">
              {data.improvements.map((improvement, idx) => (
                <li key={idx} className="text-muted-foreground">{improvement}</li>
              ))}
            </ul>
          </div>
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
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingReport, setGradingReport] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onMessage: (message) => {
      const newMessage: Message = {
        role: message.source === "user" ? "user" : "assistant",
        content: message.message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newMessage]);
    },
    onError: (error) => {
      console.error("Conversation error:", error);
      toast.error("An error occurred during the conversation");
    }
  });

  useEffect(() => {
    if (!token) {
      toast.error("No access token provided");
      setIsValidating(false);
      return;
    }

    validateToken();

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const signedUrl = `https://api.elevenlabs.io/v1/convai/conversation?agent_id=YOUR_AGENT_ID`;
      await conversation.startSession({ signedUrl });
      
      toast.success("Conversation started!");
    } catch (error) {
      console.error("Failed to start conversation:", error);
      toast.error("Failed to start conversation. Please check microphone permissions.");
    }
  };

  const handleStop = async () => {
    await conversation.endSession();
    toast.success("Conversation ended");
  };

  const handleGrade = async () => {
    if (messages.length === 0) {
      toast.error("No conversation to grade");
      return;
    }

    setIsGrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('grade-roleplay', {
        body: { messages, token }
      });

      if (error) throw error;

      setGradingReport(data);
      toast.success("Grading complete!");
    } catch (error) {
      console.error("Grading error:", error);
      toast.error("Failed to grade conversation");
    } finally {
      setIsGrading(false);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(18);
    doc.text("Sales Roleplay Grading Report", 20, y);
    y += 15;

    doc.setFontSize(12);
    doc.text(`Staff: ${staffName}`, 20, y);
    y += 10;
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, y);
    y += 15;

    const sections = [
      { key: 'information_verification', title: 'Information Verification' },
      { key: 'rapport', title: 'Rapport' },
      { key: 'coverage_conversation', title: 'Coverage Conversation' },
      { key: 'wrap_up', title: 'Wrap Up' },
      { key: 'lever_pulls', title: 'Lever Pulls' }
    ];

    sections.forEach(section => {
      const data = gradingReport[section.key];
      if (data) {
        doc.setFontSize(14);
        doc.text(section.title, 20, y);
        y += 8;

        doc.setFontSize(10);
        const summary = doc.splitTextToSize(data.summary || '', 170);
        doc.text(summary, 20, y);
        y += summary.length * 5 + 5;

        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      }
    });

    doc.save(`roleplay-grading-${new Date().getTime()}.pdf`);
    toast.success("PDF downloaded!");
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
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>
              This access link is invalid or has expired. Please request a new link from your manager.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <>
      <IdentityModal 
        open={showIdentityModal}
        onSubmit={handleSubmitIdentity}
        isSubmitting={isSubmittingIdentity}
      />

      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Sales Roleplay Bot</span>
                {staffName && (
                  <Badge variant="outline">Staff: {staffName}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Practice your sales conversations and receive AI-powered feedback
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={handleStart}
                  disabled={conversation.status === "connected"}
                  className="flex-1"
                >
                  <Mic className="mr-2 h-4 w-4" />
                  {conversation.status === "connected" ? "Connected" : "Start Call"}
                </Button>
                <Button
                  onClick={handleStop}
                  disabled={conversation.status !== "connected"}
                  variant="destructive"
                  className="flex-1"
                >
                  <MicOff className="mr-2 h-4 w-4" />
                  End Call
                </Button>
                <Button
                  onClick={handleGrade}
                  disabled={messages.length === 0 || isGrading || conversation.status === "connected"}
                  variant="secondary"
                >
                  {isGrading ? "Grading..." : "Grade Performance"}
                </Button>
              </div>

              {conversation.status === "connected" && (
                <div className="flex items-center gap-2 text-green-600">
                  <div className="h-2 w-2 bg-green-600 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Call in progress</span>
                </div>
              )}
            </CardContent>
          </Card>

          {messages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Conversation Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm font-medium mb-1">
                          {msg.role === "user" ? "You" : "AI Customer"}
                        </p>
                        <p className="text-sm">{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {msg.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </CardContent>
            </Card>
          )}

          {gradingReport && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Performance Grading</CardTitle>
                  <Button onClick={handleExportPDF} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
