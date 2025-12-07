import { FileQuestion, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function FormNotFoundView() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
          <FileQuestion className="w-8 h-8 text-muted-foreground" />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-foreground">Form Not Found</h1>
          <p className="text-muted-foreground leading-relaxed">
            The form you're looking for doesn't exist or may have been removed. 
            Please check the URL and try again.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
          <Button 
            onClick={() => window.location.href = '/'}
            className="gap-2"
          >
            <Home className="w-4 h-4" />
            Home
          </Button>
        </div>
      </Card>
    </div>
  );
}