import { useState, useEffect, useRef } from 'react';
import { FlowQuestion as FlowQuestionType } from '@/types/flows';
import { PromptSegment } from '@/hooks/useFlowSession';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';

interface FlowQuestionProps {
  question: FlowQuestionType;
  promptSegments: PromptSegment[];
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLast: boolean;
  autoFocus?: boolean;
}

export function FlowQuestionComponent({
  question,
  promptSegments,
  value,
  onChange,
  onSubmit,
  isLast,
  autoFocus = true,
}: FlowQuestionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [question.id, autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && question.type === 'text' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSubmit();
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && question.type === 'textarea') {
      e.preventDefault();
      if (value.trim()) {
        onSubmit();
      }
    }
  };

  const toggleRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser.');
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

  const hasInterpolations = promptSegments.some(s => s.type === 'interpolated');

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🧠</span>
        <div className="space-y-3">
          {hasInterpolations ? (
            promptSegments.map((segment, idx) => (
              <p 
                key={idx}
                className={
                  segment.type === 'interpolated'
                    ? 'text-lg font-medium text-foreground leading-relaxed'
                    : 'text-lg text-muted-foreground/80 leading-relaxed'
                }
              >
                {segment.content}
              </p>
            ))
          ) : (
            <p className="text-lg leading-relaxed">
              {promptSegments[0]?.content}
            </p>
          )}
        </div>
      </div>

      <div className="pl-11">
        {question.type === 'text' && (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={question.placeholder || 'Type your answer...'}
            className="text-base"
          />
        )}

        {question.type === 'textarea' && (
          <div className="relative">
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value}
              onChange={e => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={question.placeholder || 'Take your time. Speak or type freely...'}
              className="min-h-[150px] text-base pr-12"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`absolute bottom-2 right-2 ${isRecording ? 'text-destructive' : 'text-muted-foreground'}`}
              onClick={toggleRecording}
            >
              {isRecording ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          </div>
        )}

        {question.type === 'select' && question.options && (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="text-base">
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {question.options.map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {question.type === 'textarea' && (
          <p className="text-xs text-muted-foreground/50 mt-2">
            Press Cmd/Ctrl + Enter to continue, or click the button below
          </p>
        )}
      </div>
    </div>
  );
}
