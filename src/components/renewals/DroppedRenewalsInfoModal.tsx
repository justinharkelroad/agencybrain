import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertTriangle, ArrowRight, CheckCircle2, FileUp, HelpCircle } from "lucide-react";

interface DroppedRenewalsInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  droppedCount: number;
}

export function DroppedRenewalsInfoModal({
  open,
  onOpenChange,
  droppedCount,
}: DroppedRenewalsInfoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            What are "Dropped" Records?
          </DialogTitle>
          <DialogDescription>
            {droppedCount > 0
              ? `You have ${droppedCount} renewal record${droppedCount === 1 ? '' : 's'} that dropped off the latest report.`
              : 'Understanding how dropped records work in Renewals.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* How it works */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">How it works</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <FileUp className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Each time you upload a new renewal report, we compare it against your existing records <span className="text-foreground font-medium">within the same date range</span>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Records that appear in the new report stay <span className="text-foreground font-medium">active</span> and get updated with any new data.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Records that <span className="text-foreground font-medium">don't appear</span> in the new report are marked as <span className="text-amber-400 font-medium">"dropped."</span> They need your attention to investigate and resolve.
                </p>
              </div>
            </div>
          </div>

          {/* Why records drop */}
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              Why would a renewal record drop off?
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/60" />
                <span>The customer renewed their policy and it moved off the pending list.</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/60" />
                <span>The policy was cancelled or non-renewed by the carrier.</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/60" />
                <span>The customer rewrote with a different carrier.</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/60" />
                <span>The carrier updated or corrected their report.</span>
              </li>
            </ul>
          </div>

          {/* What to do */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">What should I do?</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center text-xs font-bold text-green-500">1</div>
                <p><span className="text-foreground font-medium">Review dropped records</span> — check if the customer renewed or if the policy lapsed.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center text-xs font-bold text-green-500">2</div>
                <p><span className="text-foreground font-medium">Update the status</span> — mark as "Success" if renewed, or "Unsuccessful" if lost.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center text-xs font-bold text-green-500">3</div>
                <p>Dropped records stay in the "Dropped" view until resolved so nothing falls through the cracks.</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
