import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, XCircle } from 'lucide-react';
import type { ValidationResult } from '@/lib/dataValidation';

interface ValidationErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinueAnyway: () => void;
  onCancel: () => void;
  validationResult: ValidationResult;
}

export function ValidationErrorDialog({
  open,
  onOpenChange,
  onContinueAnyway,
  onCancel,
  validationResult,
}: ValidationErrorDialogProps) {
  const hasErrors = validationResult.errors.length > 0;
  const hasWarnings = validationResult.warnings.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            {hasErrors ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-warning" />
            )}
            <AlertDialogTitle>
              {hasErrors ? 'Data Validation Errors' : 'Data Validation Warnings'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-4">
            <p>
              Form completeness: <strong>{validationResult.completeness}%</strong>
            </p>

            {hasErrors && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="font-medium mb-2">Errors:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.errors.map((error, idx) => (
                      <li key={idx} className="text-sm">
                        {error}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {hasWarnings && (
              <Alert>
                <AlertDescription>
                  <div className="font-medium mb-2">Warnings:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {hasErrors ? (
              <p className="text-sm text-muted-foreground">
                Please fix the errors above before saving. Critical data validation has failed.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                You can continue saving, but consider addressing the warnings to ensure data quality.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {hasErrors ? 'Go Back' : 'Cancel'}
          </AlertDialogCancel>
          {!hasErrors && (
            <AlertDialogAction onClick={onContinueAnyway}>Continue Anyway</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
