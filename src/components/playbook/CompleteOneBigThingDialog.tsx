import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";

interface CompleteOneBigThingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTitle: string;
  onConfirm: (proof: string, feeling: string) => void;
}

export function CompleteOneBigThingDialog({
  open,
  onOpenChange,
  itemTitle,
  onConfirm,
}: CompleteOneBigThingDialogProps) {
  const [proof, setProof] = useState("");
  const [feeling, setFeeling] = useState("");

  // Reset form when dialog opens (prevents stale drafts from previous items)
  useEffect(() => {
    if (open) {
      setProof("");
      setFeeling("");
    }
  }, [open]);

  const handleConfirm = () => {
    onConfirm(proof.trim(), feeling.trim());
    setProof("");
    setFeeling("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <DialogTitle className="text-base">Complete Your One Big Thing</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {itemTitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="proof" className="text-sm font-medium">
              How did you confirm this was done?
            </Label>
            <Textarea
              id="proof"
              placeholder="Describe what you did to complete it..."
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feeling" className="text-sm font-medium">
              How does it feel to get this accomplished?
            </Label>
            <Textarea
              id="feeling"
              placeholder="Take a moment to reflect..."
              value={feeling}
              onChange={(e) => setFeeling(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!proof.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
