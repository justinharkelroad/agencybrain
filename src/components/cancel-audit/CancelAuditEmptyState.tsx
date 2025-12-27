import { Upload, Search, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface CancelAuditEmptyStateProps {
  variant: 'no-records' | 'no-results';
  onUploadClick?: () => void;
  onClearFilters?: () => void;
}

export function CancelAuditEmptyState({
  variant,
  onUploadClick,
  onClearFilters,
}: CancelAuditEmptyStateProps) {
  if (variant === 'no-results') {
    return (
      <Card className="p-12 bg-card border-border">
        <div className="text-center">
          <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            No records match your filters
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Try adjusting your search or filter criteria
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
