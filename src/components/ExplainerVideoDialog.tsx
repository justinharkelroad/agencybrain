import React from 'react';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';

interface ExplainerVideoDialogProps {
  videoUrl: string;
  triggerText?: string;
}

const ExplainerVideoDialog: React.FC<ExplainerVideoDialogProps> = ({
  videoUrl,
  triggerText = 'The What & The Why For This Process',
}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">{triggerText}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>The What & The Why For This Process</DialogTitle>
          <DialogDescription>
            Watch this short explainer to understand the process and how to get the most from it.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md overflow-hidden">
          <AspectRatio ratio={16 / 9}>
            <iframe
              src={videoUrl}
              title="Explainer video - The What & The Why For This Process"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              loading="lazy"
            />
          </AspectRatio>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExplainerVideoDialog;
