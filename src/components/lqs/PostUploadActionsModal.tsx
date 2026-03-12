import { useState, useCallback, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, FileText, ListChecks, ChevronRight } from 'lucide-react';
import type { UploadedHouseholdInfo } from '@/types/lqs';
import { BreakupLetterModal } from '@/components/sales/BreakupLetterModal';
import { ApplySequenceModal } from '@/components/onboarding/ApplySequenceModal';

type Phase = 'select' | 'breakup-letter' | 'apply-sequence' | 'complete';

interface PostUploadActionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  households: UploadedHouseholdInfo[];
  agencyId: string;
  staffSessionToken?: string | null;
  onComplete?: () => void;
}

export function PostUploadActionsModal({
  open,
  onOpenChange,
  households,
  agencyId,
  staffSessionToken,
  onComplete,
}: PostUploadActionsModalProps) {
  // Selection state
  const [enableBreakupLetters, setEnableBreakupLetters] = useState(true);
  const [enableOnboarding, setEnableOnboarding] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(households.map(h => h.householdId)));

  // Step-through state
  const [phase, setPhase] = useState<Phase>('select');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);

  // Guard against double-fire from sub-modal callbacks (onOpenChange + onContinueToSequence)
  const advancingRef = useRef(false);

  // Re-sync selectedIds when households prop changes (e.g. second upload while component stays mounted)
  useEffect(() => {
    setSelectedIds(new Set(households.map(h => h.householdId)));
    setPhase('select');
    setCurrentIndex(0);
    setProcessedCount(0);
  }, [households]);

  // Clear the advancing guard after each render so it's ready for the next interaction
  useEffect(() => {
    advancingRef.current = false;
  });

  const selectedHouseholds = households.filter(h => selectedIds.has(h.householdId));
  const currentHousehold = selectedHouseholds[currentIndex] ?? null;

  const resetState = useCallback(() => {
    setPhase('select');
    setCurrentIndex(0);
    setProcessedCount(0);
    setEnableBreakupLetters(true);
    setEnableOnboarding(true);
    setSelectedIds(new Set(households.map(h => h.householdId)));
  }, [households]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      resetState();
      onComplete?.();
    }
    onOpenChange(nextOpen);
  }, [onOpenChange, resetState, onComplete]);

  const toggleHousehold = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(households.map(h => h.householdId)));
  }, [households]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleContinue = useCallback(() => {
    if (selectedHouseholds.length === 0) return;
    setCurrentIndex(0);
    setProcessedCount(0);
    if (enableBreakupLetters) {
      setPhase('breakup-letter');
    } else if (enableOnboarding) {
      setPhase('apply-sequence');
    } else {
      handleOpenChange(false);
    }
  }, [selectedHouseholds.length, enableBreakupLetters, enableOnboarding, handleOpenChange]);

  const advanceToNext = useCallback(() => {
    if (advancingRef.current) return; // Guard: already advancing this tick
    advancingRef.current = true;

    const nextIndex = currentIndex + 1;
    setProcessedCount(prev => prev + 1);

    if (nextIndex >= selectedHouseholds.length) {
      setPhase('complete');
      return;
    }

    setCurrentIndex(nextIndex);
    if (enableBreakupLetters) {
      setPhase('breakup-letter');
    } else {
      setPhase('apply-sequence');
    }
  }, [currentIndex, selectedHouseholds.length, enableBreakupLetters]);

  const handleBreakupDone = useCallback(() => {
    if (advancingRef.current) return; // Guard: already called this tick
    if (enableOnboarding) {
      advancingRef.current = true;
      setPhase('apply-sequence');
    } else {
      advanceToNext();
    }
  }, [enableOnboarding, advanceToNext]);

  const handleSequenceDone = useCallback(() => {
    advanceToNext();
  }, [advanceToNext]);

  // Build breakup policies from household data
  const breakupPolicies = currentHousehold?.policies.map((p, idx) => ({
    id: `upload-${currentIndex}-${idx}`,
    policyTypeName: p.productType,
    policyNumber: p.policyNumber || '',
    effectiveDate: format(new Date(), 'yyyy-MM-dd'),
    carrierName: '',
  })) ?? [];

  // Safety: if we're in step-through but currentHousehold is null, fall through to complete
  // (handled via useEffect to avoid setState-during-render)
  useEffect(() => {
    if ((phase === 'breakup-letter' || phase === 'apply-sequence') && !currentHousehold) {
      setPhase('complete');
    }
  }, [phase, currentHousehold]);

  // Selection phase
  if (phase === 'select') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Post-Upload Actions</DialogTitle>
            <DialogDescription>
              Choose actions to perform for uploaded households.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Action checkboxes */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={enableBreakupLetters}
                  onCheckedChange={(v) => setEnableBreakupLetters(!!v)}
                />
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Generate Breakup Letters</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={enableOnboarding}
                  onCheckedChange={(v) => setEnableOnboarding(!!v)}
                />
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Apply Onboarding Sequence</span>
              </label>
            </div>

            {/* Household list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} of {households.length} households selected
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll}>Select All</Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>Deselect All</Button>
                </div>
              </div>
              <ScrollArea className="max-h-[280px] rounded-md border">
                <div className="p-2 space-y-1">
                  {households.map(h => (
                    <label
                      key={h.householdId}
                      className="flex items-center gap-3 px-2 py-2 rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedIds.has(h.householdId)}
                        onCheckedChange={() => toggleHousehold(h.householdId)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{h.customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {h.policies.map(p => p.productType).join(', ')}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Skip All
              </Button>
              <Button
                onClick={handleContinue}
                disabled={selectedIds.size === 0 || (!enableBreakupLetters && !enableOnboarding)}
              >
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Completion phase
  if (phase === 'complete') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              All Done
            </DialogTitle>
            <DialogDescription>
              Processed {processedCount} of {selectedHouseholds.length} households.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-2">
            <Button onClick={() => handleOpenChange(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Step-through phases — render ONLY the sub-modal (no wrapper Dialog underneath)
  // Closing the sub-modal = skip for this household
  if (!currentHousehold) return null; // useEffect above will correct phase

  if (phase === 'breakup-letter') {
    return (
      <BreakupLetterModal
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) handleBreakupDone();
        }}
        agencyId={agencyId}
        customerName={currentHousehold.customerName}
        customerZip={currentHousehold.customerZip ?? undefined}
        policies={breakupPolicies}
        onContinueToSequence={handleBreakupDone}
        contactId={currentHousehold.contactId ?? undefined}
        sourceContext="sale_upload"
      />
    );
  }

  if (phase === 'apply-sequence') {
    return (
      <ApplySequenceModal
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) handleSequenceDone();
        }}
        householdId={currentHousehold.householdId}
        contactId={currentHousehold.contactId ?? undefined}
        customerName={currentHousehold.customerName}
        agencyId={agencyId}
        onSuccess={handleSequenceDone}
        staffSessionToken={staffSessionToken}
      />
    );
  }

  return null;
}
