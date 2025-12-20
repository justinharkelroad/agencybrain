import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Image as ImageIcon, Download, ExternalLink, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

interface ExchangeFilePreviewProps {
  filePath: string;
  fileName: string;
  className?: string;
}

export function ExchangeFilePreview({ filePath, fileName, className }: ExchangeFilePreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const fileExtension = fileName.split('.').pop()?.toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '');
  const isPdf = fileExtension === 'pdf';
  
  const getSignedUrl = async () => {
    if (signedUrl) return signedUrl;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('uploads')
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      
      if (error) throw error;
      setSignedUrl(data.signedUrl);
      return data.signedUrl;
    } catch (error) {
      console.error('Failed to get signed URL:', error);
      // Fallback to public URL
      const publicUrl = `https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/uploads/${filePath}`;
      setSignedUrl(publicUrl);
      return publicUrl;
    } finally {
      setLoading(false);
    }
  };
  
  const handleClick = async () => {
    const url = await getSignedUrl();
    if (!url) return;
    
    if (isImage) {
      setLightboxOpen(true);
    } else {
      window.open(url, '_blank');
    }
  };
  
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = await getSignedUrl();
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      a.click();
    }
  };
  
  return (
    <>
      <div
        onClick={handleClick}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group",
          className
        )}
      >
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          {loading ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : isImage ? (
            <ImageIcon className="h-5 w-5 text-primary" />
          ) : isPdf ? (
            <FileText className="h-5 w-5 text-red-500" />
          ) : (
            <FileText className="h-5 w-5 text-primary" />
          )}
        </div>
        
        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
          <p className="text-xs text-muted-foreground">
            {isImage ? 'Click to view' : isPdf ? 'Click to open PDF' : 'Click to download'}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
          {(isImage || isPdf) && (
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Image Lightbox */}
      {isImage && (
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-black/95">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            {signedUrl && (
              <img
                src={signedUrl}
                alt={fileName}
                className="max-w-full max-h-[85vh] object-contain mx-auto"
              />
            )}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-white text-sm text-center">{fileName}</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
