import { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Send, Paperclip, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useConversationMessages, 
  useSendMessage, 
  useMarkMessagesRead,
  ExchangeConversation 
} from '@/hooks/useExchangeMessages';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface ExchangeConversationViewProps {
  conversation: ExchangeConversation;
  onBack?: () => void;
}

export function ExchangeConversationView({ conversation, onBack }: ExchangeConversationViewProps) {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data: messages, isLoading } = useConversationMessages(conversation.id);
  const sendMessage = useSendMessage();
  const markRead = useMarkMessagesRead();
  
  // Mark messages as read when viewing
  useEffect(() => {
    if (conversation.id && conversation.unread_count > 0) {
      markRead.mutate(conversation.id);
    }
  }, [conversation.id, conversation.unread_count]);
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMessage.mutate(
      { conversationId: conversation.id, content: newMessage.trim() },
      { onSuccess: () => setNewMessage('') }
    );
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const otherUserInitials = conversation.other_user?.full_name
    ? conversation.other_user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : conversation.other_user?.email?.[0]?.toUpperCase() || '?';
  
  return (
    <Card className="flex flex-col h-full border-border/50 bg-card/50">
      {/* Header */}
      <CardHeader className="border-b border-border/50 py-3 px-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {otherUserInitials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">
              {conversation.other_user?.full_name || conversation.other_user?.email || 'Unknown User'}
            </p>
            {conversation.other_user.agency?.name && (
              <p className="text-xs text-muted-foreground">{conversation.other_user.agency.name}</p>
            )}
          </div>
        </div>
      </CardHeader>
      
      {/* Messages */}
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full p-4" ref={scrollRef}>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                  <div className="h-10 w-48 bg-muted rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-3">
              {messages.map(msg => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[70%] rounded-lg px-3 py-2",
                        isMe
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={cn(
                        "text-[10px] mt-1",
                        isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
      
      {/* Input */}
      <div className="border-t border-border/50 p-3">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
