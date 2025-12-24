export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-muted/50 rounded-2xl rounded-tl-md w-fit">
      <span 
        className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-typing-bounce"
        style={{ animationDelay: '0s' }}
      />
      <span 
        className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-typing-bounce"
        style={{ animationDelay: '0.15s' }}
      />
      <span 
        className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-typing-bounce"
        style={{ animationDelay: '0.3s' }}
      />
    </div>
  );
}
