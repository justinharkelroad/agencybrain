import { Upload, Search, FileWarning, CircleDot, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RecordStatus } from '@/types/cancel-audit';

interface CancelAuditEmptyStateProps {
  variant: 'no-records' | 'no-results';
  onUploadClick?: () => void;
  onClearFilters?: () => void;
  statusFilter?: RecordStatus | 'all';
  searchQuery?: string;
  showUntouchedOnly?: boolean;
}

export function CancelAuditEmptyState({
  variant,
  onUploadClick,
  onClearFilters,
  statusFilter,
  searchQuery,
  showUntouchedOnly,
}: CancelAuditEmptyStateProps) {
  if (variant === 'no-results') {
    // Generate context-specific message
    let message = 'Try adjusting your search or filter criteria';
    let icon = <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />;
    let title = 'No records match your filters';
    
    if (showUntouchedOnly) {
      icon = <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-70" />;
      title = 'All records have been contacted!';
      message = 'Great work - every record has at least one activity logged.';
    } else if (statusFilter === 'resolved') {
      icon = <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />;
      title = 'No resolved records yet';
      message = 'Keep making contacts - payments will start coming in!';
    } else if (statusFilter === 'new') {
      title = 'No new records';
      message = 'All records have been worked on. Great progress!';
    } else if (searchQuery) {
      title = `No results for "${searchQuery}"`;
      message = 'Try a different search term or clear filters.';
    }

    return (
      <Card className="p-12 bg-card border-border">
        <div className="text-center">
          {icon}
          <h3 className="text-lg font-medium text-foreground mb-2">
            {title}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {message}
          </p>
          {onClearFilters && (
            <Button variant="outline" onClick={onClearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-12 bg-card border-border border-dashed">
      <div className="text-center">
        <FileWarning className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-medium text-foreground mb-2">No records yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Upload your first Cancellation Audit or Pending Cancel report to start 
          tracking and managing at-risk policies.
        </p>
        {onUploadClick && (
          <Button onClick={onUploadClick} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Your First Report
          </Button>
        )}
      </div>
    </Card>
  );
}
