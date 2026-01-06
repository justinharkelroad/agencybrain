import { AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LeadSourceExtended, MarketingBucket } from '@/types/lqs';

interface UnassignedLeadSourcesSectionProps {
  sources: LeadSourceExtended[];
  buckets: MarketingBucket[];
  onAssignBucket: (sourceId: string, bucketId: string) => Promise<void>;
  loading?: boolean;
}

export const UnassignedLeadSourcesSection = ({
  sources,
  buckets,
  onAssignBucket,
  loading = false,
}: UnassignedLeadSourcesSectionProps) => {
  if (sources.length === 0 || buckets.length === 0) return null;

  return (
    <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg p-4">
      <div className="flex items-start gap-2 mb-3">
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-amber-800 dark:text-amber-200">
            Unassigned Lead Sources
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Assign these lead sources to marketing buckets for accurate ROI tracking.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {sources.map((source) => (
          <div
            key={source.id}
            className="flex items-center justify-between gap-3 py-2 px-3 bg-background rounded border"
          >
            <span className={`text-sm ${!source.is_active ? 'text-muted-foreground' : ''}`}>
              {source.name}
              {!source.is_active && <span className="ml-1 text-xs">(inactive)</span>}
            </span>

            <Select
              value=""
              onValueChange={(bucketId) => onAssignBucket(source.id, bucketId)}
              disabled={loading}
            >
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Assign to bucket..." />
              </SelectTrigger>
              <SelectContent>
                {buckets.map((bucket) => (
                  <SelectItem key={bucket.id} value={bucket.id}>
                    {bucket.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
};
