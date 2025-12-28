import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface MembershipGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
}

export function MembershipGateModal({ 
  open, 
  onOpenChange, 
  featureName 
}: MembershipGateModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            1:1 Coaching Feature
          </DialogTitle>
          <DialogDescription>
            {featureName} is available exclusively for 1:1 Coaching members.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To access this feature, please contact us to upgrade your membership to 1:1 Coaching.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button 
              onClick={() => window.open('mailto:support@standardplaybook.com?subject=1:1 Coaching Upgrade Inquiry', '_blank')}
            >
              Contact Us
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
