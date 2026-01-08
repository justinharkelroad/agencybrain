import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Users, Home, ShoppingCart, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SalesUploadResult } from '@/types/lqs';

interface SalesUploadResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: SalesUploadResult;
}

export function SalesUploadResultsModal({ open, onOpenChange, results }: SalesUploadResultsModalProps) {
  const hasWarnings = results.unmatchedProducers.length > 0 || results.householdsNeedingAttention > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Sales Upload Complete
          </DialogTitle>
          <DialogDescription>
            Successfully processed {results.recordsProcessed} records
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={ShoppingCart}
              label="Sales Created"
              value={results.salesCreated}
              subtext="new sale records"
              iconColor="text-green-500"
            />
            <StatCard
              icon={Home}
              label="Households"
              value={results.householdsMatched + results.householdsCreated}
              subtext={`${results.householdsMatched} matched, ${results.householdsCreated} new`}
              iconColor="text-blue-500"
            />
            <StatCard
              icon={Link2}
              label="Quotes Linked"
              value={results.quotesLinked}
              subtext="matched to quotes"
              iconColor="text-purple-500"
            />
            <StatCard
              icon={Users}
              label="Team Matched"
              value={results.teamMembersMatched}
              subtext="unique producers"
              iconColor="text-orange-500"
            />
          </div>

          {/* Warnings Section */}
          {hasWarnings && (
            <div className="space-y-3">
              {/* Unmatched Producers */}
              {results.unmatchedProducers.length > 0 && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                        {results.unmatchedProducers.length} sub-producer(s) not matched
                      </p>
                      <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {results.unmatchedProducers.slice(0, 5).map((name, idx) => (
                          <li key={idx} className="truncate">• {name}</li>
                        ))}
                        {results.unmatchedProducers.length > 5 && (
                          <li className="text-muted-foreground/70">
                            +{results.unmatchedProducers.length - 5} more
                          </li>
                        )}
                      </ul>
                      <p className="text-xs text-muted-foreground mt-2">
                        Add sub-producer codes in Team Settings to enable automatic matching.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Needs Lead Source */}
              {results.householdsNeedingAttention > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        {results.householdsNeedingAttention} households need lead source
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Assign lead sources to accurately track marketing ROI.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Errors */}
          {results.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">
                {results.errors.length} error(s) occurred
              </p>
              <ul className="text-xs text-destructive/80 mt-1">
                {results.errors.slice(0, 3).map((err, idx) => (
                  <li key={idx}>• {err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  subtext: string;
  iconColor: string;
}

function StatCard({ icon: Icon, label, value, subtext, iconColor }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-muted/50 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("h-4 w-4", iconColor)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </div>
  );
}
