import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Download, Loader2, AlertCircle, Printer, ExternalLink } from 'lucide-react';
import { useGenerateDeliverablesPdf } from '@/hooks/useSalesExperienceDeliverables';

interface DeliverablesPDFDialogProps {
  children?: React.ReactNode;
  assignmentId?: string;
}

export function DeliverablesPDFDialog({ children, assignmentId }: DeliverablesPDFDialogProps) {
  const [open, setOpen] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string>('');

  const generatePdf = useGenerateDeliverablesPdf();

  const handleGenerate = async () => {
    try {
      const result = await generatePdf.mutateAsync(assignmentId);
      setHtmlContent(result.html);
      setAgencyName(result.agency_name);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handlePrint = () => {
    if (!htmlContent) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handleDownload = () => {
    if (!htmlContent) return;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agencyName.replace(/\s+/g, '_')}_Sales_Experience_Deliverables.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenInNewTab = () => {
    if (!htmlContent) return;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Generate PDF
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Deliverables PDF
          </DialogTitle>
          <DialogDescription>
            Generate a professional PDF of your Sales Experience deliverables with your agency branding.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!htmlContent ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              {generatePdf.error ? (
                <Alert variant="destructive" className="max-w-md">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{generatePdf.error.message}</AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-center max-w-sm">
                    Click the button below to generate a PDF containing all three deliverables:
                    Sales Process, Accountability Metrics, and Consequence Ladder.
                  </p>
                </>
              )}

              <Button
                onClick={handleGenerate}
                disabled={generatePdf.isPending}
                className="gap-2"
              >
                {generatePdf.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Generate PDF
              </Button>
            </div>
          ) : (
            <div className="h-[500px] border rounded-lg overflow-hidden bg-white">
              <iframe
                srcDoc={htmlContent}
                className="w-full h-full"
                title="Deliverables PDF Preview"
              />
            </div>
          )}
        </div>

        {htmlContent && (
          <DialogFooter className="flex-shrink-0 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setHtmlContent(null);
                generatePdf.reset();
              }}
            >
              Regenerate
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleOpenInNewTab} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Open in New Tab
              </Button>
              <Button variant="outline" onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                Download HTML
              </Button>
              <Button onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Print / Save as PDF
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
