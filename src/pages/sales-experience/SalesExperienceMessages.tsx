import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useSalesExperienceAccess } from '@/hooks/useSalesExperienceAccess';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  ArrowLeft,
  MessageSquare,
  Send,
  User,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  assignment_id: string;
  sender_type: 'coach' | 'owner' | 'manager';
  sender_user_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  sender: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export default function SalesExperienceMessages() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const { hasAccess, assignment, isLoading: accessLoading } = useSalesExperienceAccess();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages using edge function
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['sales-experience-messages', assignment?.id],
    enabled: hasAccess && !!assignment?.id && !!session?.access_token,
    refetchInterval: 30000,
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-experience-messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'list',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch messages');
      }

      return response.json();
    },
  });

  const messages = useMemo(() => messagesData?.messages || [], [messagesData?.messages]);

  // Mark messages as read
  useEffect(() => {
    if (!messages.length || !session?.access_token || !user?.id) return;

    const unreadMessages = messages.filter(
      (m: Message) => !m.read_at && m.sender_user_id !== user.id && m.sender_type === 'coach'
    );

    if (unreadMessages.length === 0) return;

    const markAsRead = async () => {
      for (const message of unreadMessages) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-experience-messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              action: 'mark_read',
              message_id: message.id,
            }),
          }
        );
      }
    };

    markAsRead();
  }, [messages, session?.access_token, user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!assignment?.id || !session?.access_token) {
        throw new Error('Missing assignment or session');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-experience-messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'send',
            assignment_id: assignment.id,
            content,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      return response.json();
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({
        queryKey: ['sales-experience-messages', assignment?.id],
      });
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessage.mutate(newMessage.trim());
  };

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  // Sort messages chronologically (oldest first)
  const sortedMessages = [...messages].sort(
    (a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      {/* Back Link */}
      <Link
        to="/sales-experience"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Overview
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Coach Messages</h1>
        <p className="text-muted-foreground">
          Direct communication with your 8-Week Experience coach
        </p>
      </div>

      {/* Messages Card */}
      <Card className="flex flex-col h-[calc(100vh-300px)] min-h-[500px]">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversation
          </CardTitle>
        </CardHeader>

        {/* Messages List */}
        <ScrollArea className="flex-1 p-4">
          {messagesLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedMessages.length > 0 ? (
            <div className="space-y-4">
              {sortedMessages.map((message: Message) => {
                const isCoach = message.sender_type === 'coach';
                const isOwnMessage = message.sender_user_id === user?.id;

                return (
                  <div
                    key={message.id}
                    className={`flex items-start gap-3 ${
                      isOwnMessage ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback
                        className={
                          isCoach
                            ? 'bg-amber-500 text-white'
                            : 'bg-primary text-primary-foreground'
                        }
                      >
                        {isCoach ? (
                          <Trophy className="h-5 w-5" />
                        ) : (
                          <User className="h-5 w-5" />
                        )}
                      </AvatarFallback>
                    </Avatar>

                    <div
                      className={`flex-1 max-w-[80%] ${
                        isOwnMessage ? 'text-right' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {isCoach
                            ? 'Coach'
                            : message.sender?.full_name || 'You'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(message.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <div
                        className={`inline-block rounded-lg px-4 py-2 ${
                          isCoach
                            ? 'bg-amber-500/10 text-foreground'
                            : isOwnMessage
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No messages yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Start a conversation with your coach. They're here to help you
                succeed in your 8-Week Sales Experience.
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Message Input */}
        <div className="p-4 border-t">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Textarea
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 self-end"
              disabled={!newMessage.trim() || sendMessage.isPending}
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </Card>
    </div>
  );
}
