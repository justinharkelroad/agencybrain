import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface HowItWorksModalProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function HowItWorksModal({ title, children, className }: HowItWorksModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 px-2.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary gap-1.5 ${className ?? ''}`}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Info className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">How It Works</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-4">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
