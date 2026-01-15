import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Lightbulb, ArrowRight, Loader2 } from 'lucide-react';

interface RevisionRequiredCardProps {
  engagementScore: number;
  issues: string[];
  specificGuidance: string;
  lessonHighlights: string[];
  revisionCount: number;
  reflection1: string;
  reflection2: string;
  onReflectionChange: (field: 'reflection_1' | 'reflection_2', value: string) => void;
  onResubmit: () => void;
  isSubmitting: boolean;
}

export function RevisionRequiredCard({
  engagementScore,
  issues,
  specificGuidance,
  lessonHighlights,
  revisionCount,
  reflection1,
  reflection2,
  onReflectionChange,
  onResubmit,
  isSubmitting
}: RevisionRequiredCardProps) {
  const [hasEdited, setHasEdited] = useState(false);

  const handleChange = (field: 'reflection_1' | 'reflection_2', value: string) => {
    onReflectionChange(field, value);
    setHasEdited(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Warning Header */}
      <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg text-amber-900 dark:text-amber-100">
                Your reflections need more depth
              </CardTitle>
              <CardDescription className="text-amber-700 dark:text-amber-300">
                Before we can provide personalized coaching, please take another look at your responses.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-amber-700 border-amber-500">
              Score: {engagementScore}/10
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* AI Guidance */}
      <Card className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base text-blue-900 dark:text-blue-100">
                What to improve
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Specific guidance */}
          {specificGuidance && (
            <p className="text-blue-800 dark:text-blue-200 leading-relaxed">
              {specificGuidance}
            </p>
          )}

          {/* Issues list */}
          {issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Areas to address:
              </h4>
              <ul className="space-y-1">
                {issues.map((issue, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300">
                    <span className="text-blue-500">•</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lesson highlights */}
          {lessonHighlights.length > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-blue-100/50 dark:bg-blue-900/30">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                Key concepts from this lesson you could reference:
              </h4>
              <ul className="space-y-1">
                {lessonHighlights.map((highlight, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-200">
                    <span className="text-blue-500 font-bold">{idx + 1}.</span>
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editable Reflections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revise Your Reflections</CardTitle>
          <CardDescription>
            Update your answers to be more specific about what you learned from this lesson.
            {revisionCount > 0 && (
              <span className="ml-2 text-amber-600">
                (Revision {revisionCount + 1})
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="revision_reflection1" className="font-medium">
              1. What was the most valuable insight you gained from this lesson?
            </Label>
            <Textarea
              id="revision_reflection1"
              placeholder="Be specific about concepts, techniques, or examples from the lesson..."
              value={reflection1}
              onChange={(e) => handleChange('reflection_1', e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Reference specific concepts, terms, or examples from the training content.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="revision_reflection2" className="font-medium">
              2. How will you apply what you learned to your work?
            </Label>
            <Textarea
              id="revision_reflection2"
              placeholder="Describe a specific situation where you'll use this..."
              value={reflection2}
              onChange={(e) => handleChange('reflection_2', e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Be concrete about WHEN and HOW you'll apply this (e.g., "In my next call with a prospect who objects to price, I will...")
            </p>
          </div>

          <Button
            onClick={onResubmit}
            className="w-full mt-4"
            size="lg"
            disabled={isSubmitting || !hasEdited}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                Submit Revised Reflections
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>

          {!hasEdited && (
            <p className="text-center text-sm text-muted-foreground">
              Please update your reflections before resubmitting
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
