import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Send,
  Sparkles,
  Loader2,
  CheckCircle2,
  User,
  Bot,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { useDeliverableBuilder, ChatMessage } from '@/hooks/useDeliverableBuilder';
import type { DeliverableType, DeliverableContent } from '@/hooks/useSalesExperienceDeliverables';
import { deliverableInfo } from '@/hooks/useSalesExperienceDeliverables';
import { cn } from '@/lib/utils';

interface DeliverableBuilderChatProps {
  deliverableId: string;
  deliverableType: DeliverableType;
  onContentApplied?: () => void;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isLast: boolean;
}

function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const copyContent = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : '')}>
      <div className={cn(
        'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn(
        'flex-1 max-w-[80%] group',
        isUser ? 'text-right' : ''
      )}>
        <div className={cn(
          'inline-block rounded-lg px-4 py-2 text-sm whitespace-pre-wrap',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}>
          {message.content}
        </div>
        {!isUser && (
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 h-7 px-2"
            onClick={copyContent}
          >
            {copied ? (
              <Check className="h-3 w-3 mr-1" />
            ) : (
              <Copy className="h-3 w-3 mr-1" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </div>
    </div>
  );
}

function GeneratedContentPreview({ content, type }: { content: DeliverableContent; type: DeliverableType }) {
  if (type === 'sales_process') {
    const sp = content as { rapport: string[]; coverage: string[]; closing: string[] };
    return (
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="font-medium mb-1">Rapport</div>
          <ul className="list-disc list-inside text-muted-foreground">
            {sp.rapport?.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div>
          <div className="font-medium mb-1">Coverage</div>
          <ul className="list-disc list-inside text-muted-foreground">
            {sp.coverage?.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div>
          <div className="font-medium mb-1">Closing</div>
          <ul className="list-disc list-inside text-muted-foreground">
            {sp.closing?.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      </div>
    );
  }

  if (type === 'accountability_metrics') {
    const am = content as { categories: Array<{ name: string; items: string[] }> };
    return (
      <div className="space-y-2 text-xs">
        {am.categories?.map((cat, i) => (
          <div key={i}>
            <div className="font-medium">{cat.name}</div>
            <ul className="list-disc list-inside text-muted-foreground">
              {cat.items?.map((item, j) => <li key={j}>{item}</li>)}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'consequence_ladder') {
    const cl = content as { steps: Array<{ incident: number; title: string; description: string }> };
    return (
      <div className="space-y-2 text-xs">
        {cl.steps?.map((step, i) => (
          <div key={i} className="flex gap-2">
            <span className="font-medium">{step.incident}.</span>
            <div>
              <span className="font-medium">{step.title}</span>
              <span className="text-muted-foreground"> - {step.description}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export function DeliverableBuilderChat({ deliverableId, deliverableType, onContentApplied }: DeliverableBuilderChatProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const info = deliverableInfo[deliverableType];

  const {
    messages,
    generatedContent,
    hasActiveSession,
    isLoading,
    isStarting,
    isSending,
    isApplying,
    startSession,
    sendMessage,
    applyContent,
    startError,
    sendError,
    applyError,
  } = useDeliverableBuilder(deliverableId);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input after sending
  useEffect(() => {
    if (!isSending && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSending]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    const message = inputValue.trim();
    setInputValue('');

    try {
      await sendMessage(message);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApply = async () => {
    try {
      await applyContent();
      onContentApplied?.();
    } catch (error) {
      // Error handled by hook
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!hasActiveSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Guided Builder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Let our AI guide you through building your {info.title}. Answer a few questions
            and we'll generate structured content for you to review and customize.
          </p>

          {startError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{startError.message}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={() => startSession()}
            disabled={isStarting}
            className="w-full gap-2"
          >
            {isStarting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Start Building
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" />
            Building: {info.title}
          </CardTitle>
          {generatedContent && (
            <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
              <CheckCircle2 className="h-3 w-3" />
              Content Ready
            </Badge>
          )}
        </div>
      </CardHeader>

      <ScrollArea ref={scrollRef} className="flex-1 px-4">
        <div className="space-y-4 pb-4">
          {messages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
              isLast={index === messages.length - 1}
            />
          ))}
          {isSending && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {generatedContent && (
        <div className="flex-shrink-0 px-4 py-3 border-t bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Generated Content Preview</span>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={isApplying}
              className="gap-1"
            >
              {isApplying ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              Apply & Continue
            </Button>
          </div>
          <div className="bg-background rounded-md p-3 border max-h-32 overflow-y-auto">
            <GeneratedContentPreview content={generatedContent} type={deliverableType} />
          </div>
          {applyError && (
            <p className="text-xs text-destructive mt-2">{applyError.message}</p>
          )}
        </div>
      )}

      <CardFooter className="flex-shrink-0 pt-3 border-t">
        {sendError && (
          <p className="text-xs text-destructive mb-2 w-full">{sendError.message}</p>
        )}
        <div className="flex gap-2 w-full">
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your response..."
            rows={1}
            className="min-h-[40px] max-h-[120px] resize-none"
            disabled={isSending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
