import { Button } from "@/components/ui/button";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

const SUGGESTED_QUESTIONS = [
  "How do I submit my reporting period?",
  "Where can I manage my team?",
  "What training resources are available?",
];

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground font-medium">Suggested questions:</p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="text-xs h-auto py-1.5 px-2.5 whitespace-normal text-left"
            onClick={() => onSelect(question)}
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}
