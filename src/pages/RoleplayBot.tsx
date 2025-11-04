import { useState, useEffect, useRef } from 'react';
import { useConversation } from '@11labs/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const RoleplayBot = () => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
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
      // Clear previous messages
      setMessages([]);
      
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

        {/* Right Sidebar - Transcript Only */}
        <div className="lg:col-span-1">{" "}

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
        </div>
      </div>
    </div>
  );
};

export default RoleplayBot;
