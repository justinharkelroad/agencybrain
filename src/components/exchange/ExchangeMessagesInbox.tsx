import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConversations, ExchangeConversation } from '@/hooks/useExchangeMessages';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface ExchangeMessagesInboxProps {
  selectedId?: string;
  onSelect: (conversation: ExchangeConversation) => void;
}

export function ExchangeMessagesInbox({ selectedId, onSelect }: ExchangeMessagesInboxProps) {
  const { data: conversations, isLoading } = useConversations();
  const [search, setSearch] = useState('');
  
  const filteredConversations = conversations?.filter(conv => {
    if (!search) return true;
    const name = conv.other_user.full_name || conv.other_user.email;
    return name.toLowerCase().includes(search.toLowerCase());
  });
  
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-3 w-32 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="pl-9"
          />
        </div>
      </div>
      
      {/* Conversations List */}
      <ScrollArea className="flex-1">
        {filteredConversations && filteredConversations.length > 0 ? (
          <div className="p-2 space-y-1">
            {filteredConversations.map(conv => {
              const initials = conv.other_user.full_name
                ? conv.other_user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                : conv.other_user.email[0].toUpperCase();
              
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                    selectedId === conv.id
                      ? "bg-muted"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {conv.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "font-medium text-sm truncate",
                        conv.unread_count > 0 && "text-foreground"
                      )}>
                        {conv.other_user.full_name || conv.other_user.email}
                      </span>
                      {conv.last_message && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    {conv.last_message?.content && (
                      <p className={cn(
                        "text-xs truncate mt-0.5",
                        conv.unread_count > 0 ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {conv.last_message.content}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-center p-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No conversations found' : 'No messages yet'}
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
