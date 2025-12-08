import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

interface FlowChallengeProps {
  challenge: string;
  onRevise: () => void;
  onSkip: () => void;
}

export function FlowChallenge({ challenge, onRevise, onSkip }: FlowChallengeProps) {
  return (
    <Card className="border-primary/30 bg-primary/5 mt-4 ml-11">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <MessageCircle className="h-5 w-5 text-primary mt-0.5" strokeWidth={1.5} />
          <div className="flex-1">
            <p className="text-sm leading-relaxed">{challenge}</p>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={onRevise}>
                Revise Answer
              </Button>
              <Button size="sm" variant="ghost" onClick={onSkip}>
                Skip & Continue →
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
