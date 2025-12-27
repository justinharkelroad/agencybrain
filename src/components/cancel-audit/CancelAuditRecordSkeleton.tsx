import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function CancelAuditRecordSkeleton() {
  return (
    <Card className="px-4 py-3">
      <div className="flex items-center gap-4">
        {/* Status dot */}
        <Skeleton className="h-2.5 w-2.5 rounded-full" />

        {/* Name */}
        <div className="flex-1 sm:flex-none sm:w-48 space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-12" />
        </div>

        {/* Policy Number */}
        <Skeleton className="hidden sm:block h-4 w-24" />

        {/* Product */}
        <Skeleton className="hidden md:block h-4 w-16" />

        {/* Date */}
        <div className="hidden sm:block w-28 text-right space-y-1">
          <Skeleton className="h-4 w-20 ml-auto" />
          <Skeleton className="h-3 w-14 ml-auto" />
        </div>

        {/* Premium */}
        <Skeleton className="hidden md:block h-4 w-16" />

        {/* Activity badge */}
        <Skeleton className="hidden lg:block h-5 w-16 rounded" />

        {/* Chevron */}
        <Skeleton className="h-5 w-5 rounded" />
      </div>
    </Card>
  );
}

export function CancelAuditRecordSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CancelAuditRecordSkeleton key={i} />
      ))}
    </div>
  );
}
