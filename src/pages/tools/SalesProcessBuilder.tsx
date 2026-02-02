import { useState, useRef, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  Send,
  Sparkles,
  User,
  Bot,
  CheckCircle2,
  Save,
  Plus,
  GripVertical,
  X,
  MessageSquare,
  Edit3,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useSalesProcessBuilderAccess,
  useStandaloneSalesProcessBuilder,
  type ChatMessage,
  type SalesProcessContent,
  type SalesProcessSession,
} from '@/hooks/useStandaloneSalesProcess';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ============================================
// Message Bubble Component
// ============================================

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const copyContent = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : '')}>
      <div className={cn(
        'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn('flex-1 max-w-[80%] group', isUser ? 'text-right' : '')}>
        <div className={cn(
          'inline-block rounded-lg px-4 py-2 text-sm whitespace-pre-wrap',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}>
          {message.content}
        </div>
        {!isUser && (
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 h-7 px-2"
            onClick={copyContent}
          >
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// Generated Content Preview
// ============================================

function GeneratedContentPreview({ content }: { content: SalesProcessContent }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div>
        <div className="font-semibold mb-1">Rapport</div>
        <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
          {content.rapport?.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>
      <div>
        <div className="font-semibold mb-1">Coverage</div>
        <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
          {content.coverage?.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>
      <div>
        <div className="font-semibold mb-1">Closing</div>
        <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
          {content.closing?.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
}

// ============================================
// AI Builder Tab
// ============================================

interface AIBuilderTabProps {
  initialSession: SalesProcessSession | null;
  onContentApplied: () => void;
}

function AIBuilderTab({ initialSession, onContentApplied }: AIBuilderTabProps) {
  const [session, setSession] = useState<SalesProcessSession | null>(initialSession);
  const [messages, setMessages] = useState<ChatMessage[]>(initialSession?.messages_json || []);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<SalesProcessContent | null>(
    initialSession?.generated_content_json || null
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const { startSession, sendMessage, applyContent, isLoading } = useStandaloneSalesProcessBuilder();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleStart = async () => {
    try {
      const data = await startSession();
      setSession(data.session);
      setMessages(data.session.messages_json);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start session');
    }
  };

  const handleSend = async () => {
    if (!session || !inputValue.trim() || isSending) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsSending(true);

    try {
      const data = await sendMessage(session.id, userMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      if (data.generated_content) {
        setGeneratedContent(data.generated_content);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleApply = async () => {
    if (!session) return;

    try {
      await applyContent(session.id);
      toast.success('Sales Process saved!');
      onContentApplied();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to apply content');
    }
  };

  // Not started state
  if (!session) {
    return (
      <Card className="h-[600px] flex flex-col items-center justify-center">
        <Sparkles className="h-16 w-16 text-primary mb-4" />
        <h3 className="text-xl font-semibold mb-2">Build with AI</h3>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          Start a guided conversation with the AgencyBrain Sales Architect to build your custom Sales Process.
        </p>
        <Button onClick={handleStart} disabled={isLoading} size="lg">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <MessageSquare className="h-4 w-4 mr-2" />
              Start Building
            </>
          )}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Sales Architect
            </CardTitle>
            <CardDescription>Building your custom Sales Process</CardDescription>
          </div>
          {generatedContent && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Content Ready
            </Badge>
          )}
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {isSending && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {generatedContent && (
        <div className="px-4 pb-3">
          <Alert className="bg-green-500/10 border-green-500/30">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-green-600">Your Sales Process is ready!</span>
                <Button size="sm" onClick={handleApply}>
                  Apply & Save
                </Button>
              </div>
              <GeneratedContentPreview content={generatedContent} />
            </AlertDescription>
          </Alert>
        </div>
      )}

      <CardFooter className="border-t pt-4">
        <div className="flex gap-2 w-full">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your response..."
            className="min-h-[44px] max-h-[120px] resize-none"
            disabled={isSending}
          />
          <Button onClick={handleSend} disabled={!inputValue.trim() || isSending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

// ============================================
// Sortable Item for Editor
// ============================================

interface SortableItemProps {
  id: string;
  item: string;
  onRemove: () => void;
  onUpdate: (value: string) => void;
}

function SortableItem({ id, item, onRemove, onUpdate }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-muted/50 rounded-md p-2 group">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <Input
        value={item}
        onChange={(e) => onUpdate(e.target.value)}
        className="flex-1 h-8 bg-background"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================
// Phase Column for Editor
// ============================================

interface PhaseColumnProps {
  title: string;
  description: string;
  items: string[];
  phaseKey: string;
  onItemsChange: (items: string[]) => void;
}

function PhaseColumn({ title, description, items, phaseKey, onItemsChange }: PhaseColumnProps) {
  const [newItem, setNewItem] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((_, i) => `${phaseKey}-${i}` === active.id);
      const newIndex = items.findIndex((_, i) => `${phaseKey}-${i}` === over.id);
      onItemsChange(arrayMove(items, oldIndex, newIndex));
    }
  };

  const addItem = () => {
    if (newItem.trim()) {
      onItemsChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((_, i) => `${phaseKey}-${i}`)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item, index) => (
                <SortableItem
                  key={`${phaseKey}-${index}`}
                  id={`${phaseKey}-${index}`}
                  item={item}
                  onRemove={() => onItemsChange(items.filter((_, i) => i !== index))}
                  onUpdate={(value) => {
                    const newItems = [...items];
                    newItems[index] = value;
                    onItemsChange(newItems);
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex gap-2">
          <Input
            placeholder="Add new item..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            className="flex-1"
          />
          <Button variant="outline" size="icon" onClick={addItem}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Manual Editor Tab
// ============================================

interface ManualEditorTabProps {
  initialContent: SalesProcessContent;
  onSaved: () => void;
}

function ManualEditorTab({ initialContent, onSaved }: ManualEditorTabProps) {
  const [content, setContent] = useState<SalesProcessContent>(initialContent);
  const [isSaving, setIsSaving] = useState(false);

  const { saveContent } = useStandaloneSalesProcessBuilder();

  const handleSave = async (markComplete = false) => {
    setIsSaving(true);
    try {
      await saveContent(content, markComplete);
      toast.success(markComplete ? 'Sales Process marked complete!' : 'Draft saved!');
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const isComplete = content.rapport.length > 0 && content.coverage.length > 0 && content.closing.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PhaseColumn
          title="Rapport"
          description="How do you build trust and connect?"
          items={content.rapport}
          phaseKey="rapport"
          onItemsChange={(items) => setContent({ ...content, rapport: items })}
        />
        <PhaseColumn
          title="Coverage"
          description="How do you present coverage options?"
          items={content.coverage}
          phaseKey="coverage"
          onItemsChange={(items) => setContent({ ...content, coverage: items })}
        />
        <PhaseColumn
          title="Closing"
          description="How do you ask for the business?"
          items={content.closing}
          phaseKey="closing"
          onItemsChange={(items) => setContent({ ...content, closing: items })}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          Save Draft
        </Button>
        <Button onClick={() => handleSave(true)} disabled={isSaving || !isComplete}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Mark Complete
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Main Page Component
// ============================================

export default function SalesProcessBuilder() {
  const { data, isLoading, error, refetch } = useSalesProcessBuilderAccess();
  const [activeTab, setActiveTab] = useState<'build' | 'edit'>('build');

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-6 w-96 mb-8" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!data?.hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  const salesProcess = data.salesProcess;
  const session = data.session;
  const hasContent = salesProcess && (
    salesProcess.content_json.rapport.length > 0 ||
    salesProcess.content_json.coverage.length > 0 ||
    salesProcess.content_json.closing.length > 0
  );

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Sales Process Builder</h1>
          {salesProcess?.status === 'complete' && (
            <Badge className="bg-green-500 text-white">Complete</Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Build your agency's custom Sales Process with AI guidance or manual editing.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'build' | 'edit')}>
        <TabsList className="mb-6">
          <TabsTrigger value="build" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Build with AI
          </TabsTrigger>
          <TabsTrigger value="edit" className="gap-2">
            <Edit3 className="h-4 w-4" />
            Edit Directly
          </TabsTrigger>
        </TabsList>

        <TabsContent value="build">
          <AIBuilderTab
            initialSession={session}
            onContentApplied={() => {
              refetch();
              setActiveTab('edit');
            }}
          />
        </TabsContent>

        <TabsContent value="edit">
          <ManualEditorTab
            initialContent={salesProcess?.content_json || { rapport: [], coverage: [], closing: [] }}
            onSaved={() => refetch()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
