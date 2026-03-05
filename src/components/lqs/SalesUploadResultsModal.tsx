import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Users, Home, ShoppingCart, Link2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SalesUploadResult } from '@/types/lqs';

interface SalesUploadResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: SalesUploadResult;
  onReviewNow?: () => void;
}

export function SalesUploadResultsModal({ open, onOpenChange, results, onReviewNow }: SalesUploadResultsModalProps) {
  const hasWarnings = results.unmatchedProducers.length > 0 || results.householdsNeedingAttention > 0;
  const hasErrors = results.errors.length > 0;
  const hasReviews = results.needsReview > 0;
  const quickStatus = `${results.salesCreated} of ${results.recordsProcessed} rows imported`;
  const notImportedCount = Math.max(results.recordsProcessed - results.salesCreated, 0);
  const importedHouseholds = new Set(results.uploadedHouseholds.map((h) => h.householdId)).size;
  const leadSourceWarningCount = Math.min(results.householdsNeedingAttention, importedHouseholds);
  const lowerErrors = results.errors.map((err) => err.toLowerCase());
  const duplicateCount = lowerErrors.filter((err) =>
    err.includes('duplicate') || err.includes('already exists in lqs and was skipped')
  ).length;
  const customerNotFoundCount = lowerErrors.filter((err) =>
    err.includes('could not be matched to a customer record')
  ).length;
  const customerCreateFailedCount = lowerErrors.filter((err) =>
    err.includes('could not create this customer in lqs')
  ).length;
  const quoteLinkCheckFailedCount = lowerErrors.filter((err) =>
    err.includes('could not verify matching quote details')
  ).length;
  const categorizedCount =
    duplicateCount +
    customerNotFoundCount +
    customerCreateFailedCount +
    quoteLinkCheckFailedCount;
  const otherNotImportedCount = Math.max(notImportedCount - categorizedCount, 0);
  const supportGuide = [
    {
      match: 'could not be matched to a customer record',
      title: 'Customer not found',
      action: 'Check first name, last name, zip, and policy number. Create the household in LQS first if needed.',
    },
    {
      match: 'already exists in lqs and was skipped',
      title: 'Duplicate sale',
      action: 'This sale already exists in LQS. Remove the duplicate line from the upload file and re-upload.',
    },
    {
      match: 'could not create this customer in lqs',
      title: 'Customer create failed',
      action: 'Try re-uploading once. If it keeps failing, fix the customer row fields and save in a fresh upload.',
    },
    {
      match: 'could not verify matching quote details',
      title: 'Quote link check failed',
      action: 'Make sure a quote exists for the same household + product + recent date range, then re-upload.',
    },
  ];

  const supportIssues = supportGuide
    .map((item) => {
      const count = results.errors.filter((err) => err.toLowerCase().includes(item.match)).length;
      return { ...item, count };
    })
    .filter((item) => item.count > 0);
  const ruleSummary = results.uploadRuleSummary;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            {hasErrors
              ? 'Sales Upload Completed with Issues'
              : hasReviews
                ? 'Sales Upload Needs Review'
                : 'Sales Upload Complete'}
          </DialogTitle>
          <DialogDescription>
            {hasErrors
              ? `${quickStatus}. ${notImportedCount} rows were not imported.`
              : hasReviews
                ? `${results.autoMatched} auto-matched, ${results.needsReview} need manual review`
                : results.autoMatched > 0
                  ? `${results.autoMatched} rows auto-matched`
                  : results.endorsementsSkipped > 0
                    ? `${results.recordsProcessed} rows processed (${results.endorsementsSkipped} endorsements skipped)`
                    : `All ${results.recordsProcessed} rows were imported`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-semibold">Import Outcome</p>
            <ul className="mt-1 space-y-1 text-sm">
              <li>• <span className="font-medium">Imported:</span> {results.salesCreated}</li>
              <li>• <span className="font-medium">Not imported:</span> {notImportedCount}</li>
            </ul>
            {notImportedCount > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-muted-foreground">Why rows were not imported</p>
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {duplicateCount > 0 && <li>• {duplicateCount} duplicate row(s)</li>}
                  {customerNotFoundCount > 0 && <li>• {customerNotFoundCount} customer match issue(s)</li>}
                  {customerCreateFailedCount > 0 && <li>• {customerCreateFailedCount} customer create issue(s)</li>}
                  {quoteLinkCheckFailedCount > 0 && <li>• {quoteLinkCheckFailedCount} quote-link check issue(s)</li>}
                  {otherNotImportedCount > 0 && <li>• {otherNotImportedCount} other issue(s)</li>}
                </ul>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              icon={ShoppingCart}
              label="Rows Imported"
              value={results.salesCreated}
              subtext="new sales saved to LQS"
              iconColor="text-green-500"
            />
            <StatCard
              icon={Home}
              label="Households Imported"
              value={importedHouseholds}
              subtext="households with at least 1 imported sale"
              iconColor="text-blue-500"
            />
            <StatCard
              icon={Link2}
              label="New Quote Links"
              value={results.quotesLinked}
              subtext="imported sales linked to existing quotes"
              iconColor="text-purple-500"
            />
          </div>

          {ruleSummary && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">Upload Rule Summary</p>
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                <li>• {ruleSummary.fileRows} rows in file</li>
                <li>• {ruleSummary.endorsementsSkipped} skipped (endorsements / add-item)</li>
                <li>• {ruleSummary.motorClubExcluded} excluded from dashboard metrics (Motor Club)</li>
                <li>• {ruleSummary.countableRows} count toward dashboard metrics</li>
              </ul>
            </div>
          )}

          {/* Warnings Section */}
          {hasWarnings && (
            <div className="space-y-3">
              {/* Unmatched Producers */}
              {results.unmatchedProducers.length > 0 && (
                <div className="rounded-lg border border-yellow-500/50 dark:border-yellow-500/30 bg-yellow-500/15 p-3">
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
                        These are producer codes found in the file. They are not always import failures by themselves.
                        Add the missing producer names/codes in Team Settings, then click Re-run Producer Matching.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Needs Lead Source */}
              {leadSourceWarningCount > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        {leadSourceWarningCount} imported household(s) are missing lead source
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        These sales are imported, but they will be excluded from marketing ROI until a lead source is assigned.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Producer Codes Found</span>
            </div>
            <p className="text-xl font-semibold">{results.teamMembersMatched}</p>
            <p className="text-xs text-muted-foreground">unique matched producer codes in this file</p>
          </div>

          {/* Review Button */}
          {hasReviews && onReviewNow && (
            <Button variant="outline" onClick={onReviewNow} className="gap-2">
              <Eye className="h-4 w-4" />
              Review matches now ({results.needsReview})
            </Button>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
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
