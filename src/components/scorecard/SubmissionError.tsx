import { AlertCircle, RefreshCw, Info, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SCORECARD_ERRORS, ScorecardErrorCode, isScorecardError } from '@/lib/scorecardErrors';

interface SubmissionErrorProps {
  errorCode: string;
  errorMessage?: string; // Fallback message from server
  onRetry?: () => void;
  onRefresh?: () => void;
}

export function SubmissionError({ 
  errorCode, 
  errorMessage,
  onRetry, 
  onRefresh 
}: SubmissionErrorProps) {
  // Check if it's a known error code
  const isKnown = isScorecardError(errorCode);
  const errorInfo = isKnown ? SCORECARD_ERRORS[errorCode] : null;
  
  // Fallback for unknown errors
  const title = errorInfo?.title || 'Submission Error';
  const message = errorInfo?.message || errorMessage || 'An unexpected error occurred.';
  const action = errorInfo?.action || 'Please try again or contact support.';
  const severity = errorInfo?.severity || 'error';
  const canRetry = errorInfo?.canRetry ?? true;

  const Icon = severity === 'error' 
    ? AlertCircle 
    : severity === 'warning' 
      ? AlertTriangle 
      : Info;

  return (
    <Alert variant={severity === 'error' ? 'destructive' : severity === 'warning' ? 'warning' : 'default'}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p className="mt-1">{message}</p>
        <p className="mt-2 text-sm text-muted-foreground">{action}</p>
        
        <div className="flex gap-2 mt-4">
          {canRetry && onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Try Again
            </Button>
          )}
          {onRefresh && (
            <Button size="sm" variant="ghost" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh Page
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
