import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export interface QuizQuestion {
  question_text: string;
  question_type: "multiple_choice" | "true_false" | "text_response";
  sort_order: number;
  options: QuizOption[];
  is_required_reflection?: boolean;
}

export interface QuizOption {
  option_text: string;
  is_correct: boolean;
  sort_order: number;
}

export interface QuizData {
  name: string;
  description: string;
  questions: QuizQuestion[];
}

interface QuizBuilderProps {
  lessonId: string;
  agencyId: string;
  onSave?: (quizData: QuizData) => void;
  initialData?: QuizData;
}

export function QuizBuilder({ lessonId, agencyId, onSave, initialData }: QuizBuilderProps) {
  const [quizName, setQuizName] = useState(initialData?.name || "");
  const [quizDescription, setQuizDescription] = useState(initialData?.description || "");
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    initialData?.questions && initialData.questions.length > 0
      ? initialData.questions
      : [createEmptyQuestion(0)]
  );

  // Default reflection questions - always required
  const reflectionQuestions: QuizQuestion[] = [
    {
      question_text: "What is the main takeaway?",
      question_type: "text_response",
      sort_order: 1000,
      options: [],
      is_required_reflection: true,
    },
    {
      question_text: "Why do you feel that is an important takeaway?",
      question_type: "text_response",
      sort_order: 1001,
      options: [],
      is_required_reflection: true,
    },
  ];

  function createEmptyQuestion(index: number): QuizQuestion {
    return {
      question_text: "",
      question_type: "multiple_choice",
      sort_order: index,
      options: [
        { option_text: "", is_correct: false, sort_order: 0 },
        { option_text: "", is_correct: false, sort_order: 1 },
        { option_text: "", is_correct: false, sort_order: 2 },
        { option_text: "", is_correct: false, sort_order: 3 },
      ],
    };
  }

  const addQuestion = () => {
    setQuestions([...questions, createEmptyQuestion(questions.length)]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) {
      toast.error("Quiz must have at least one question");
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    // Reorder
    updated.forEach((q, i) => (q.sort_order = i));
    setQuestions(updated);
  };

  const updateQuestion = (index: number, field: keyof QuizQuestion, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };

    // If switching to true/false, update options
    if (field === "question_type" && value === "true_false") {
      updated[index].options = [
        { option_text: "True", is_correct: false, sort_order: 0 },
        { option_text: "False", is_correct: false, sort_order: 1 },
      ];
    }
    // If switching to multiple choice, reset options
    if (field === "question_type" && value === "multiple_choice") {
      updated[index].options = [
        { option_text: "", is_correct: false, sort_order: 0 },
        { option_text: "", is_correct: false, sort_order: 1 },
        { option_text: "", is_correct: false, sort_order: 2 },
        { option_text: "", is_correct: false, sort_order: 3 },
      ];
    }

    setQuestions(updated);
  };

  const updateOption = (questionIndex: number, optionIndex: number, field: keyof QuizOption, value: any) => {
    const updated = [...questions];
    const options = [...updated[questionIndex].options];
    options[optionIndex] = { ...options[optionIndex], [field]: value };

    // If marking as correct, unmark others
    if (field === "is_correct" && value === true) {
      options.forEach((opt, idx) => {
        if (idx !== optionIndex) opt.is_correct = false;
      });
    }

    updated[questionIndex].options = options;
    setQuestions(updated);
  };

  const addOption = (questionIndex: number) => {
    const updated = [...questions];
    const options = [...updated[questionIndex].options];
    options.push({
      option_text: "",
      is_correct: false,
      sort_order: options.length,
    });
    updated[questionIndex].options = options;
    setQuestions(updated);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions];
    const options = [...updated[questionIndex].options];
    if (options.length <= 2) {
      toast.error("Questions must have at least 2 options");
      return;
    }
    options.splice(optionIndex, 1);
    // Reorder
    options.forEach((opt, idx) => (opt.sort_order = idx));
    updated[questionIndex].options = options;
    setQuestions(updated);
  };

  const handleSave = () => {
    // Validation
    if (!quizName.trim()) {
      toast.error("Quiz must have a name");
      return;
    }

    for (const q of questions) {
      if (!q.question_text.trim()) {
        toast.error("All questions must have text");
        return;
      }

      // Skip option validation for text_response questions
      if (q.question_type === "text_response") {
        continue;
      }

      const hasCorrectAnswer = q.options.some((opt) => opt.is_correct);
      if (!hasCorrectAnswer) {
        toast.error("All questions must have a correct answer selected");
        return;
      }

      if (q.question_type === "multiple_choice") {
        const hasEmptyOptions = q.options.some((opt) => !opt.option_text.trim());
        if (hasEmptyOptions) {
          toast.error("All options must have text");
          return;
        }
      }
    }

    onSave?.({
      name: quizName,
      description: quizDescription,
      questions: [...questions, ...reflectionQuestions],
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 space-y-4">
        <div>
          <Label>Quiz Name *</Label>
          <Input
            placeholder="Enter quiz name..."
            value={quizName}
            onChange={(e) => setQuizName(e.target.value)}
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            placeholder="Optional quiz description..."
            value={quizDescription}
            onChange={(e) => setQuizDescription(e.target.value)}
            rows={2}
          />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Quiz Questions</h3>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Quiz
          </Button>
        </div>
      </div>

      {questions.map((question, qIndex) => (
        <Card key={qIndex} className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <Label className="text-sm font-medium">Question {qIndex + 1}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeQuestion(qIndex)}
              disabled={questions.length === 1}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Question Text</Label>
            <Textarea
              placeholder="Enter your question..."
              value={question.question_text}
              onChange={(e) => updateQuestion(qIndex, "question_text", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Question Type</Label>
            <Select
              value={question.question_type}
              onValueChange={(value) => updateQuestion(qIndex, "question_type", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                <SelectItem value="true_false">True/False</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Options (select the correct answer)</Label>
            <div className="space-y-2">
              {question.options.map((option, oIndex) => (
                <div key={oIndex} className="flex items-center gap-2">
                  <RadioGroup
                    value={question.options.findIndex((o) => o.is_correct).toString()}
                    onValueChange={(value) => {
                      updateOption(qIndex, parseInt(value), "is_correct", true);
                    }}
                  >
                    <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}-o${oIndex}`} />
                  </RadioGroup>
                  <Input
                    value={option.option_text}
                    onChange={(e) => updateOption(qIndex, oIndex, "option_text", e.target.value)}
                    placeholder={`Option ${oIndex + 1}`}
                    disabled={question.question_type === "true_false"}
                    className="flex-1"
                  />
                  {question.question_type === "multiple_choice" && question.options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(qIndex, oIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {question.question_type === "multiple_choice" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addOption(qIndex)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            )}
          </div>
        </Card>
      ))}

      {/* Required Reflection Questions (Read-only) */}
      <Card className="p-4 border-dashed border-2 border-primary/30 bg-primary/5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-semibold">Required Takeaway Questions</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          These questions are automatically added to every quiz and are required for submission.
        </p>
        
        <div className="space-y-3">
          <div className="p-3 bg-background rounded-md">
            <Label className="text-sm">1. What is the main takeaway?</Label>
            <p className="text-xs text-muted-foreground mt-1">Text response (required)</p>
          </div>
          <div className="p-3 bg-background rounded-md">
            <Label className="text-sm">2. Why do you feel that is an important takeaway?</Label>
            <p className="text-xs text-muted-foreground mt-1">Text response (required)</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
