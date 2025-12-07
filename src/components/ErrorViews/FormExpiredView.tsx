import { Clock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function FormExpiredView() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
          <Clock className="w-8 h-8 text-destructive" />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-foreground">Form Expired</h1>
          <p className="text-muted-foreground leading-relaxed">
            This form link has expired and is no longer accepting submissions. 
            Please contact the form owner for a new link.
          </p>
        </div>
        
        <div className="pt-4">
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>
      </Card>
    </div>
  );
}