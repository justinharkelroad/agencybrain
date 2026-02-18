import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useGenerateLessonContent, useGenerateQuizFromLesson, useGenerateSPQuiz, useRewriteLessonContent } from '@/hooks/useTrainingAI';
import type { SPQuizQuestion } from '@/hooks/useTrainingAI';

interface AIContentPanelProps {
  agencyId: string | null;
  lessonId: string | null;
  lessonName: string;
  contentHtml: string;
  onContentGenerated: (html: string) => void;
  onQuizGenerated: () => void;
  /** SP mode: receives quiz questions in sp_quizzes JSON format instead of writing to training_quizzes */
  onSPQuizGenerated?: (questions: SPQuizQuestion[]) => void;
}

type RewriteMode = 'clearer' | 'concise' | 'actionable' | 'beginner_friendly';

const rewriteLabels: Record<RewriteMode, string> = {
  clearer: 'Make it Clearer',
  concise: 'Make it Concise',
  actionable: 'More Actionable',
  beginner_friendly: 'Beginner Friendly',
};

export function AIContentPanel({
  agencyId,
  lessonId,
  lessonName,
  contentHtml,
  onContentGenerated,
  onQuizGenerated,
  onSPQuizGenerated,
}: AIContentPanelProps) {
  const isSPMode = agencyId === null;
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('generate');
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>('clearer');
  const [quizSuccess, setQuizSuccess] = useState(false);
  const [rewriteNote, setRewriteNote] = useState(false);

  const generateLesson = useGenerateLessonContent();
  const generateQuiz = useGenerateQuizFromLesson();
  const generateSPQuiz = useGenerateSPQuiz();
  const rewriteContent = useRewriteLessonContent();

  const handleGenerateLesson = () => {
    if (!topic.trim()) return;
    setRewriteNote(false);
    generateLesson.mutate(
      { topic: topic.trim(), lesson_name: lessonName, agency_id: agencyId },
      {
        onSuccess: (html) => {
          onContentGenerated(html);
          setTopic('');
        },
      }
    );
  };

  const handleGenerateQuiz = () => {
    if (!contentHtml.trim()) return;
    setQuizSuccess(false);

    if (isSPMode) {
      // SP mode: call edge function only, return transformed questions to parent
      generateSPQuiz.mutate(
        {
          lesson_content: contentHtml,
          lesson_name: lessonName,
          agency_id: agencyId,
          question_count: questionCount,
        },
        {
          onSuccess: (questions) => {
            setQuizSuccess(true);
            onSPQuizGenerated?.(questions);
          },
        }
      );
    } else {
      // Agency training mode: write to training_quizzes tables
      if (!lessonId) return;
      generateQuiz.mutate(
        {
          lesson_id: lessonId,
          lesson_content: contentHtml,
          lesson_name: lessonName,
          agency_id: agencyId,
          question_count: questionCount,
        },
        {
          onSuccess: () => {
            setQuizSuccess(true);
            onQuizGenerated();
          },
        }
      );
    }
  };

  const handleRewrite = () => {
    if (!contentHtml.trim()) return;
    setRewriteNote(false);
    rewriteContent.mutate(
      { existing_content: contentHtml, rewrite_mode: rewriteMode, agency_id: agencyId },
      {
        onSuccess: (html) => {
          onContentGenerated(html);
          setRewriteNote(true);
        },
      }
    );
  };

  const hasContent = contentHtml.trim().length > 0;
  const quizDisabled = !hasContent;
  const quizPending = isSPMode ? generateSPQuiz.isPending : generateQuiz.isPending;

  return (
    <Card className="border-dashed">
      <CardHeader
        className="cursor-pointer py-3 px-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            AI Content Generator
          </CardTitle>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-4 px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="generate">Generate Draft</TabsTrigger>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <TabsTrigger value="quiz" disabled={quizDisabled} className="w-full">
                        Generate Quiz
                      </TabsTrigger>
                    </span>
                  </TooltipTrigger>
                  {quizDisabled && (
                    <TooltipContent>Add lesson content first</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <TabsTrigger value="rewrite" disabled={!hasContent} className="w-full">
                        Rewrite Content
                      </TabsTrigger>
                    </span>
                  </TooltipTrigger>
                  {!hasContent && (
                    <TooltipContent>Add lesson content first</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </TabsList>

            {/* Generate Draft */}
            <TabsContent value="generate" className="space-y-3 mt-3">
              <div>
                <Label htmlFor="ai-topic" className="text-sm">What should this lesson cover?</Label>
                <Textarea
                  id="ai-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. How to handle an irate caller, step-by-step objection handling for price pushback, bullet points welcome"
                  className="mt-1"
                  rows={3}
                />
              </div>
              <Button
                onClick={handleGenerateLesson}
                disabled={!topic.trim() || generateLesson.isPending}
                size="sm"
              >
                {generateLesson.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate Lesson Content
              </Button>
            </TabsContent>

            {/* Generate Quiz */}
            <TabsContent value="quiz" className="space-y-3 mt-3">
              {!isSPMode && !lessonId ? (
                <p className="text-sm text-muted-foreground">
                  Save this lesson first to generate a quiz.
                </p>
              ) : (
                <>
                  <div>
                    <Label htmlFor="ai-question-count" className="text-sm">Number of questions</Label>
                    <Input
                      id="ai-question-count"
                      type="number"
                      min={3}
                      max={10}
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Math.min(10, Math.max(3, parseInt(e.target.value) || 5)))}
                      className="mt-1 w-24"
                    />
                  </div>
                  <Button
                    onClick={handleGenerateQuiz}
                    disabled={quizPending}
                    size="sm"
                  >
                    {quizPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Generate Quiz Questions
                  </Button>
                  {quizSuccess && (
                    <Badge variant="secondary" className="ml-2">
                      {isSPMode
                        ? 'Quiz questions generated — scroll down to review'
                        : 'Quiz questions added — check the Quiz tab'}
                    </Badge>
                  )}
                </>
              )}
            </TabsContent>

            {/* Rewrite Content */}
            <TabsContent value="rewrite" className="space-y-3 mt-3">
              <div className="flex flex-wrap gap-2">
                {(Object.entries(rewriteLabels) as [RewriteMode, string][]).map(([mode, label]) => (
                  <Button
                    key={mode}
                    variant={rewriteMode === mode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRewriteMode(mode)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <Button
                onClick={handleRewrite}
                disabled={rewriteContent.isPending}
                size="sm"
              >
                {rewriteContent.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Rewrite Content
              </Button>
              {rewriteNote && (
                <p className="text-xs text-muted-foreground">
                  Content rewritten by AI — save to keep changes
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
