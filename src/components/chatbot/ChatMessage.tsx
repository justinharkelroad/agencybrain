import { cn } from "@/lib/utils";
import { StanAvatar } from "./StanAvatar";

export interface ChatMessageData {
  id: string;
  role: 'user' | 'stan';
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: ChatMessageData;
  isLatest?: boolean;
}

export function ChatMessage({ message, isLatest = false }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        "flex gap-2 max-w-[85%]",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      {!isUser && (
        <StanAvatar 
          variant={isLatest ? "talking" : "idle"} 
          size="sm" 
          animate={false}
          className="flex-shrink-0 mt-1" 
        />
      )}
      <div
        className={cn(
          "px-3 py-2 rounded-2xl text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md shadow-sm"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}