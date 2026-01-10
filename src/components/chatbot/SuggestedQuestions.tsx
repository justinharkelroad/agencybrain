import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
  portal: 'brain' | 'staff';
}

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  '/dashboard': [
    "What do the dashboard metrics mean?",
    "How do I track my progress?",
    "Where can I see my focus targets?"
  ],
  '/submit': [
    "How do I submit my reporting period?",
    "What is auto-save?",
    "What should I enter in each section?"
  ],
  '/metrics': [
    "How do I create a scorecard form?",
    "Where can I see submissions?",
    "How do I set KPI targets?"
  ],
  '/agency': [
    "How do I add a team member?",
    "How do I create staff logins?",
    "Where do I manage lead sources?"
  ],
  '/training': [
    "What training is available?",
    "How do I track staff progress?",
    "How do I assign training modules?"
  ],
  '/bonus-grid': [
    "How does the Bonus Grid work?",
    "What are PPI values?",
    "How do I calculate my bonus tier?"
  ],
  '/call-scoring': [
    "How do I upload a call?",
    "What file formats are supported?",
    "How is my call scored?"
  ],
  '/staff/dashboard': [
    "How do I submit my scorecard?",
    "Where can I see my training?",
    "What are focus targets?"
  ],
  '/staff/training': [
    "How do I complete a training module?",
    "Where is the Standard Playbook?",
    "How do I track my progress?"
  ],
};

const DEFAULT_SUGGESTIONS = [
  "How do I get started?",
  "What features are available?",
  "How do I contact support?"
];

export function SuggestedQuestions({ onSelect, portal }: SuggestedQuestionsProps) {
  const location = useLocation();
  
  // Find suggestions based on current path
  const suggestions = Object.entries(PAGE_SUGGESTIONS)
    .find(([path]) => location.pathname.startsWith(path))?.[1] 
    || DEFAULT_SUGGESTIONS;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground font-medium">Suggested questions:</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((question, index) => (
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
