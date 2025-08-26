import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function FormLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header skeleton */}
        <Card className="p-6 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </Card>

        {/* Form fields skeleton */}
        <Card className="p-6 space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          
          {/* Submit button skeleton */}
          <div className="pt-4">
            <Skeleton className="h-10 w-32" />
          </div>
        </Card>
      </div>
    </div>
  );
}