import { useEffect, useRef } from "react";
import { X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StanAvatar, StanVariant } from "./StanAvatar";
import { ChatMessage, ChatMessageData } from "./ChatMessage";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { ChatInput } from "./ChatInput";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface StanChatWindowProps {
  messages: ChatMessageData[];
  isTyping: boolean;
  stanMood: StanVariant;
  onSendMessage: (message: string) => void;
  onClose: () => void;
  onClearChat: () => void;
  portal: 'brain' | 'staff';
}

export function StanChatWindow({ messages, isTyping, stanMood, onSendMessage, onClose, onClearChat, portal }: StanChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <div
      className={cn(
        "fixed z-50 bg-background border border-border rounded-xl shadow-2xl",
        "flex flex-col overflow-hidden",
        // Desktop positioning
        "bottom-24 right-6 w-[380px] h-[500px]",
        // Mobile - bottom sheet style
        "max-sm:bottom-0 max-sm:right-0 max-sm:left-0 max-sm:w-full max-sm:h-[70vh] max-sm:rounded-b-none max-sm:rounded-t-2xl"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/50">
        <StanAvatar variant={stanMood} size="md" />
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Stan</h3>
          <p className="text-xs text-muted-foreground">
            {stanMood === 'thinking' ? 'Thinking...' : 
             stanMood === 'celebrating' ? 'Glad to help! 🎉' :
             stanMood === 'waving' ? 'Hey there!' :
             'Your Agency Brain Assistant'}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClearChat}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear chat</TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="flex flex-col gap-3">
          {messages.map((msg, index) => (
            <ChatMessage 
              key={msg.id} 
              message={msg} 
              isLatest={index === messages.length - 1 && msg.role === 'stan'}
            />
          ))}
          
          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-2 items-start mr-auto">
              <StanAvatar variant="thinking" size="sm" />
              <div className="bg-muted px-3 py-2 rounded-2xl rounded-bl-md">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Stan is thinking</span>
                  <div className="flex gap-1">
                    <span 
                      className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" 
                      style={{ animationDelay: '0ms' }} 
                    />
                    <span 
                      className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" 
                      style={{ animationDelay: '150ms' }} 
                    />
                    <span 
                      className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" 
                      style={{ animationDelay: '300ms' }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Suggested Questions - only show when few messages */}
      {messages.length <= 2 && !isTyping && (
        <div className="px-4 pb-2">
          <SuggestedQuestions onSelect={onSendMessage} portal={portal} />
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 pt-2 border-t border-border">
        <ChatInput onSend={onSendMessage} disabled={isTyping} />
      </div>
    </div>
  );
}