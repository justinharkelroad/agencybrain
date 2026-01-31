import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PdfSlideshow } from './PdfSlideshow';
import { Separator } from '@/components/ui/separator';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  videoUrl?: string;
  videoType?: 'youtube' | 'loom';
  pdfUrl?: string;
}

export function HelpModal({ open, onClose, title, videoUrl, videoType, pdfUrl }: HelpModalProps) {
  const hasVideo = videoUrl && videoUrl.trim() !== '';
  const hasPdf = pdfUrl && pdfUrl.trim() !== '';

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background max-h-[90vh] flex flex-col">
        <DialogHeader className="p-4 pb-2 flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto flex-1">
          {/* Video Section */}
          {hasVideo && (
            <div className="aspect-video w-full bg-black">
              <iframe
                src={videoUrl}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}

          {/* Separator if both exist */}
          {hasVideo && hasPdf && (
            <Separator className="my-4" />
          )}

          {/* PDF Slideshow Section */}
          {hasPdf && (
            <div className="p-4 pt-0">
              <PdfSlideshow pdfUrl={pdfUrl} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
