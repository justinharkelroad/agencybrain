import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Loader2, Edit } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';

interface OverlappingPeriod {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface PeriodStatusBannerProps {
  hasOverlap: boolean;
  overlappingPeriod: OverlappingPeriod | null;
  isExactMatch: boolean;
  loading: boolean;
  startDate?: Date;
  endDate?: Date;
  mode?: string | null;
}

export function PeriodStatusBanner({
  hasOverlap,
  overlappingPeriod,
  isExactMatch,
  loading,
  startDate,
  endDate,
  mode,
}: PeriodStatusBannerProps) {
  // Don't show anything while loading or if in update mode (already editing a period)
  if (loading) {
    return (
      <Alert className="mb-4 border-muted bg-muted/20">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>Checking for existing submissions...</AlertDescription>
      </Alert>
    );
  }

  // Don't show the banner if we're already in update mode
  if (mode === 'update') {
    return null;
  }

  // No dates selected yet
  if (!startDate || !endDate) {
    return null;
  }

  const periodDateRange = startDate && endDate
    ? `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`
    : '';

  // Show existing period match
  if (hasOverlap && overlappingPeriod) {
    const existingDateRange = `${format(parseISO(overlappingPeriod.start_date), 'MMM d')} - ${format(parseISO(overlappingPeriod.end_date), 'MMM d, yyyy')}`;

    if (isExactMatch) {
      return (
        <Alert className="mb-4 border-amber-500 bg-amber-500/10">
          <CheckCircle2 className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600 flex items-center gap-2">
            Existing Submission Found
            <Badge variant="outline" className="text-amber-600 border-amber-500">
              {overlappingPeriod.status}
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-amber-600">
            <p>
              You already submitted for <strong>{overlappingPeriod.title || existingDateRange}</strong>.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-500/20">
                <Link to={`/submit?mode=update&periodId=${overlappingPeriod.id}`}>
                  <Edit className="h-3 w-3 mr-1" />
                  Edit Existing Period
                </Link>
              </Button>
              <span className="text-xs text-muted-foreground">
                or continue below to create a new period
              </span>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    // Overlapping but not exact match
    return (
      <Alert className="mb-4 border-blue-500 bg-blue-500/10">
        <AlertCircle className="h-4 w-4 text-blue-500" />
        <AlertTitle className="text-blue-600">
          Overlapping Period Detected
        </AlertTitle>
        <AlertDescription className="text-blue-600">
          <p>
            Your selected dates ({periodDateRange}) overlap with an existing period: <strong>{overlappingPeriod.title || existingDateRange}</strong>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-500/20">
              <Link to={`/submit?mode=update&periodId=${overlappingPeriod.id}`}>
                <Edit className="h-3 w-3 mr-1" />
                Edit Existing Period
              </Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // No overlap - show confirmation that this is a new period
  return (
    <Alert className="mb-4 border-green-500/50 bg-green-500/10">
      <CheckCircle2 className="h-4 w-4 text-green-500" />
      <AlertDescription className="text-green-600">
        No existing submission for {periodDateRange}. You're creating a new period.
      </AlertDescription>
    </Alert>
  );
}
