import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface ChatBubbleProps {
  children: ReactNode;
  variant: 'incoming' | 'outgoing';
  className?: string;
  animate?: boolean;
  icon?: string;
  onClick?: () => void;
}

export function ChatBubble({ 
  children, 
  variant, 
  className,
  animate = false,
  icon,
  onClick
}: ChatBubbleProps) {
  const isIncoming = variant === 'incoming';
  
  return (
    <div 
      className={cn(
        'flex items-end gap-2 max-w-[85%]',
        isIncoming ? 'justify-start' : 'ml-auto justify-end',
        animate && 'animate-chat-message-in',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {isIncoming && icon && (
        <span className="text-lg flex-shrink-0 mb-1">{icon}</span>
      )}
      <div
        className={cn(
          'px-4 py-3 text-base leading-relaxed',
          isIncoming 
            ? 'bg-muted/50 text-foreground rounded-2xl rounded-tl-md' 
            : 'bg-primary text-primary-foreground rounded-2xl rounded-tr-md'
        )}
      >
        {children}
      </div>
    </div>
  );
}
