import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AIQueryResponse } from '@/types/renewalAIQuery';

interface RenewalAISearchProps {
  onClear: () => void;
  sendQuery: (query: string) => void;
  clearAIQuery: () => void;
  currentResult: AIQueryResponse | null;
  isLoading: boolean;
  isActive: boolean;
  turnCount: number;
}

const PLACEHOLDER_EXAMPLES = [
  'show me monolines with big increases',
  'uncontacted auto policies in 43210',
  'bundled renewals assigned to Sarah',
  'premium over $2000 sorted by change',
];

export function RenewalAISearch({
  onClear,
  sendQuery,
  clearAIQuery,
  currentResult,
  isLoading,
  isActive,
  turnCount,
}: RenewalAISearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rotate placeholder examples
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = inputValue.trim();
    if (!query || isLoading) return;
    sendQuery(query);
    setInputValue('');
  };

  const handleClear = () => {
    setInputValue('');
    clearAIQuery();
    onClear();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      if (inputValue) {
        setInputValue('');
      } else if (isActive) {
        handleClear();
      }
    }
  };

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 via-amber-500/5 to-yellow-500/5 p-4 space-y-3">
      {/* Header callout */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-yellow-500/20">
          <Sparkles className="h-4 w-4 text-yellow-400" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-yellow-400">
            AI-Powered Search
          </span>
          <span className="text-xs text-muted-foreground">
            by AgencyBrain AI
          </span>
        </div>
        {turnCount > 0 && (
          <Badge variant="secondary" className="gap-1 ml-auto shrink-0 bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
            <MessageSquare className="h-3 w-3" />
            {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
          </Badge>
        )}
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
        <div className={cn(
          "relative flex-1 flex items-center",
          isLoading && "animate-pulse"
        )}>
          <Sparkles className={cn(
            "absolute left-3 h-4 w-4 z-10 text-yellow-400",
            isLoading && "animate-spin"
          )} />
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Try: "${PLACEHOLDER_EXAMPLES[placeholderIndex]}"`}
            className={cn(
              "pl-10 pr-4 bg-background/60 border-yellow-500/20 focus-visible:ring-yellow-500/30",
              isLoading && "border-yellow-500/50",
              isActive && !isLoading && "border-yellow-500/30"
            )}
            disabled={isLoading}
          />
        </div>

        {/* Send button */}
        <Button
          type="submit"
          size="icon"
          disabled={!inputValue.trim() || isLoading}
          className="shrink-0 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 disabled:opacity-30"
          variant="ghost"
        >
          <Send className="h-4 w-4" />
        </Button>

        {/* Clear button */}
        {isActive && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={handleClear}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {/* Active AI filter summary banner */}
      {isActive && currentResult && (
        <div className="flex items-start gap-3 px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <Sparkles className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-yellow-200">
              {currentResult.summary}
            </p>
            {currentResult.tip && (
              <p className="text-xs text-yellow-300/60 mt-1">
                {currentResult.tip}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-yellow-400 hover:text-white hover:bg-yellow-500/20 shrink-0"
            onClick={handleClear}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
