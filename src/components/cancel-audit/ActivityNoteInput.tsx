import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface ActivityNoteInputProps {
  onSave: (note: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function ActivityNoteInput({
  onSave,
  onCancel,
  isLoading = false,
  placeholder = 'Add a note about this contact...',
}: ActivityNoteInputProps) {
  const [note, setNote] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-focus when component mounts
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSave = () => {
    if (note.trim()) {
      onSave(note.trim());
    }
  };

  return (
    <div className="space-y-3">
      <Textarea
        ref={textareaRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={placeholder}
        className="min-h-[80px] resize-none bg-background border-border"
        disabled={isLoading}
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isLoading || !note.trim()}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Note'
          )}
        </Button>
      </div>
    </div>
  );
}
