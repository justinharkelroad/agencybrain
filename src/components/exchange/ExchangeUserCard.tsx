import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageCircle, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useStartConversation } from '@/hooks/useExchangeMessages';

interface ExchangeUserCardProps {
  userId: string;
  fullName: string | null;
  email: string;
  agencyName?: string | null;
  children: React.ReactNode;
}

export function ExchangeUserCard({ 
  userId, 
  fullName, 
  email, 
  agencyName, 
  children,
}: ExchangeUserCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const startConversation = useStartConversation();
  
  const displayName = fullName || email;
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  const isSelf = user?.id === userId;
  
  const handleStartConversation = async () => {
    try {
      const conversation = await startConversation.mutateAsync(userId);
      navigate(`/exchange/messages?conversation=${conversation.id}`);
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };
  
  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-72" align="start">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{displayName}</p>
            <p className="text-sm text-muted-foreground truncate">{email}</p>
            {agencyName && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{agencyName}</span>
              </div>
            )}
          </div>
        </div>
        {!isSelf && (
          <div className="mt-3 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleStartConversation}
              disabled={startConversation.isPending}
            >
              <MessageCircle className="h-4 w-4" />
              Send Message
            </Button>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
