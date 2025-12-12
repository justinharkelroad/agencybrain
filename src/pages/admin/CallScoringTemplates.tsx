import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone } from 'lucide-react';

export default function CallScoringTemplates() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Scoring Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Template management UI coming in Phase 1B...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
