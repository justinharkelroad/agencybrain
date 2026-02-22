import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import DOMPurify from 'dompurify';

/** Returns true if the string looks like HTML content produced by the rich text editor.
 *  Only matches known block-level HTML tags to avoid false positives on
 *  strings like "<please help>" or "<john@example.com>". */
export function isHtmlContent(text: string): boolean {
  return /^<(p|h[1-6]|ul|ol|li|div|blockquote|br|hr)([\s>])/i.test(text.trim());
}

interface ChatBubbleProps {
  children: ReactNode;
  variant: 'incoming' | 'outgoing';
  className?: string;
  animate?: boolean;
  icon?: string;
  avatarUrl?: string | null;
  avatarFallback?: string;
  onClick?: () => void;
  /** When provided, renders sanitized HTML instead of children text. */
  html?: string;
}

export function ChatBubble({
  children,
  variant,
  className,
  animate = false,
  icon,
  avatarUrl,
  avatarFallback,
  onClick,
  html,
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
          html ? '' : 'whitespace-pre-wrap',
          isIncoming
            ? 'bg-muted/50 text-foreground rounded-2xl rounded-tl-md'
            : 'bg-primary text-primary-foreground rounded-2xl rounded-tr-md'
        )}
      >
        {html ? (
          <div
            className={cn(
              "prose prose-sm max-w-none [&_p]:my-1 [&_h2]:my-2 [&_h3]:my-2 [&_ul]:my-1 [&_ol]:my-1",
              isIncoming
                ? "dark:prose-invert prose-headings:text-inherit prose-p:text-inherit prose-li:text-inherit prose-strong:text-inherit"
                : "[&_*]:text-inherit [&_a]:text-inherit"
            )}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(html),
            }}
          />
        ) : (
          children
        )}
      </div>
      {!isIncoming && (avatarUrl || avatarFallback) && (
        <Avatar className="h-8 w-8 flex-shrink-0 mb-1">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="You" />}
          <AvatarFallback className="bg-primary/20 text-primary text-xs">
            {avatarFallback || '??'}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
