import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Search, Plus, User, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useConversations, useStartConversation, ExchangeConversation } from '@/hooks/useExchangeMessages';
import { useExchangeUserSearch, ExchangeUser } from '@/hooks/useExchangeUserSearch';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ExchangeMessagesInboxProps {
  selectedId?: string;
  onSelect: (conversation: ExchangeConversation) => void;
}

export function ExchangeMessagesInbox({ selectedId, onSelect }: ExchangeMessagesInboxProps) {
  const { data: conversations, isLoading } = useConversations();
  const [search, setSearch] = useState('');
  const [newConvoOpen, setNewConvoOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  
  const startConversation = useStartConversation();
  const { data: searchResults, isLoading: isSearching } = useExchangeUserSearch(userSearch);
  
  const filteredConversations = conversations?.filter(conv => {
    if (!search) return true;
    const name = conv.other_user.full_name || conv.other_user.email;
    return name.toLowerCase().includes(search.toLowerCase());
  });
  
  const handleStartConversation = async (user: ExchangeUser) => {
    const result = await startConversation.mutateAsync(user.id);
    setNewConvoOpen(false);
    setUserSearch('');
    
    // Create a mock conversation to select
    const mockConv: ExchangeConversation = {
      id: result.id,
      participant_one: '',
      participant_two: '',
      last_message_at: new Date().toISOString(),
      other_user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        agency: user.agency_name ? { name: user.agency_name } : null,
      },
      unread_count: 0,
    };
    onSelect(mockConv);
  };
  
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Header with New Conversation */}
      <div className="p-4 border-b border-border/50 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Messages</h3>
          <Dialog open={newConvoOpen} onOpenChange={setNewConvoOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-4 w-4" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start a Conversation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users by name or email..."
                    className="pl-9"
                    autoFocus
                  />
                  {userSearch && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setUserSearch('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="min-h-[200px]">
                  {isSearching ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3 p-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : searchResults && searchResults.length > 0 ? (
                    <div className="space-y-1">
                      {searchResults.map(user => {
                        const initials = user.full_name
                          ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                          : user.email?.[0]?.toUpperCase() || '?';
                        
                        return (
                          <button
                            key={user.id}
                            onClick={() => handleStartConversation(user)}
                            disabled={startConversation.isPending}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {user.full_name || user.email}
                              </p>
                              {user.agency_name && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {user.agency_name}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : userSearch.length >= 2 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center">
                      <User className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No users found</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-center">
                      <Search className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Type at least 2 characters to search
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
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
              const initials = conv.other_user?.full_name
                ? conv.other_user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                : conv.other_user?.email?.[0]?.toUpperCase() || '?';
              
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
                        {conv.other_user?.full_name || conv.other_user?.email || 'Unknown User'}
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
            {!search && (
              <Button
                variant="link"
                size="sm"
                className="mt-2"
                onClick={() => setNewConvoOpen(true)}
              >
                Start a conversation
              </Button>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
