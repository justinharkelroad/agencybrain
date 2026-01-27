import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, X, Loader2, Bot, User, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useCompPlanAssistant, ExtractedCompPlanConfig } from "@/hooks/useCompPlanAssistant";
import { useAuth } from "@/lib/auth";

interface CompPlanAssistantChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string | null;
  onConfigReady: (config: ExtractedCompPlanConfig) => void;
}

export function CompPlanAssistantChat({
  open,
  onOpenChange,
  agencyId,
  onConfigReady,
}: CompPlanAssistantChatProps) {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    extractedConfig,
    sendMessage,
    resetConversation,
    processFileUpload,
    hasConfig,
  } = useCompPlanAssistant({
    agencyId,
    userId: user?.id || null,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Reset conversation when modal opens
  useEffect(() => {
    if (open) {
      resetConversation();
    }
  }, [open, resetConversation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && !selectedFile) || isLoading) return;

    let documentContent: string | null = null;
    let documentType: "text" | "image" | "pdf" | null = null;

    // Process file if selected
    if (selectedFile) {
      const processed = await processFileUpload(selectedFile);
      if (processed) {
        documentContent = processed.content;
        documentType = processed.type;
      }
    }

    const message = inputValue.trim() || "Please analyze this document and help me create a comp plan.";
    setInputValue("");
    setSelectedFile(null);

    await sendMessage(message, documentContent, documentType);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf", "text/plain", "text/csv"];
      if (!allowedTypes.includes(file.type)) {
        return;
      }
      // Images have a 5MB limit (Anthropic API restriction)
      if (file.type.startsWith("image/") && file.size > 5 * 1024 * 1024) {
        toast.error("Image must be under 5MB. Try taking a smaller screenshot or compressing the image.");
        return;
      }
      // PDFs and text files can be up to 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File must be under 10MB");
        return;
      }
      setSelectedFile(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenInBuilder = () => {
    if (extractedConfig) {
      onConfigReady(extractedConfig);
      onOpenChange(false);
    }
  };

  const handleStartOver = () => {
    resetConversation();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Comp Plan Assistant
          </DialogTitle>
          <DialogDescription>
            Describe your compensation plan or upload a document
          </DialogDescription>
        </DialogHeader>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-6" ref={scrollAreaRef}>
          <div className="py-4 space-y-4">
            {/* Welcome message if no messages */}
            {messages.length === 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm">
                      Hi! I'm here to help you set up a compensation plan.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      You can:
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      <li>Upload your existing comp plan document (PDF, image)</li>
                      <li>Describe what you want in plain English</li>
                      <li>Or both - upload a doc and I'll walk through it with you</li>
                    </ul>
                    <p className="text-sm text-muted-foreground mt-2">
                      What would you like to do?
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.hasDocument && (
                    <Badge variant="secondary" className="mb-2">
                      <FileText className="h-3 w-3 mr-1" />
                      Document attached
                    </Badge>
                  )}
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Config Ready Banner */}
        {hasConfig && (
          <div className="mx-6 mb-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Configuration Ready</p>
                  <p className="text-xs text-muted-foreground">
                    Review and adjust in the form builder
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleStartOver}>
                  Start Over
                </Button>
                <Button size="sm" onClick={handleOpenInBuilder}>
                  Open in Builder
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-6 pb-6 pt-2 border-t">
          <form onSubmit={handleSubmit} className="space-y-2">
            {/* Selected file preview */}
            {selectedFile && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              {/* File upload button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              {/* Message input */}
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Describe your comp plan or ask a question..."
                className="min-h-[44px] max-h-[120px] resize-none"
                disabled={isLoading}
                onKeyDown={(e) => {
                  // Shift+Enter to send, Enter alone creates new line
                  if (e.key === "Enter" && e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />

              {/* Send button */}
              <Button type="submit" size="icon" disabled={isLoading || (!inputValue.trim() && !selectedFile)} title="Send (Shift+Enter)">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Supports PDF (up to 10MB), images (up to 5MB), and text files • Shift+Enter to send
            </p>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
