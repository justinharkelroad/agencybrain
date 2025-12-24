import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, Mic, MicOff } from 'lucide-react';
import { FlowQuestion } from '@/types/flows';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  question: FlowQuestion;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isLast: boolean;
}

export function ChatInput({
  question,
  value,
  onChange,
  onSubmit,
  disabled = false,
  isLast,
}: ChatInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && question.type !== 'textarea') {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && question.type === 'textarea') {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  };

  const toggleRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } else {
      setIsRecording(true);
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      
      recognition.continuous = true;
      recognition.interimResults = true;
      
      let finalTranscript = value;
      
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += (finalTranscript ? ' ' : '') + event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        onChange(finalTranscript + (interimTranscript ? ' ' + interimTranscript : ''));
      };
      
      recognition.onerror = () => {
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognition.start();
    }
  };

  // Select question - show option chips
  if (question.type === 'select' && question.options) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {question.options.map(option => (
            <Button
              key={option}
              variant={value === option ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                onChange(option);
                // Auto-submit after selection with slight delay
                setTimeout(() => onSubmit(), 150);
              }}
              disabled={disabled}
              className="rounded-full"
            >
              {option}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Text or Textarea input
  return (
    <div className="flex items-end gap-2">
      {question.type === 'textarea' ? (
        <div className="relative flex-1">
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={question.placeholder || 'Type your response...'}
            className="min-h-[80px] max-h-[200px] pr-12 text-base resize-none rounded-2xl"
            disabled={disabled}
          />
          {('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'absolute bottom-2 right-2',
                isRecording ? 'text-destructive' : 'text-muted-foreground'
              )}
              onClick={toggleRecording}
              disabled={disabled}
            >
              {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
        </div>
      ) : (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={question.placeholder || 'Type your answer...'}
          className="flex-1 text-base rounded-full h-12"
          disabled={disabled}
        />
      )}
      
      <Button
        onClick={onSubmit}
        disabled={!value.trim() || disabled}
        size="icon"
        className="h-12 w-12 rounded-full flex-shrink-0"
      >
        <Send className="h-5 w-5" />
      </Button>
    </div>
  );
}
