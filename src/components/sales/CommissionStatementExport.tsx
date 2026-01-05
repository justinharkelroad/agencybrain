import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Image as ImageIcon } from "lucide-react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { PayoutCalculation } from "@/lib/payout-calculator/types";

interface CommissionStatementExportProps {
  payout: PayoutCalculation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}


export function CommissionStatementExport({ 
  payout, 
  open,
  onOpenChange,
}: CommissionStatementExportProps) {
  const statementRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const periodLabel = `${MONTHS[payout.periodMonth - 1]} ${payout.periodYear}`;
  
  // Filter to non-zero insureds
  const credits = (payout.creditInsureds || []).filter(ins => Math.abs(ins.netPremium) > 0.01);
  const chargebacks = (payout.chargebackInsureds || []).filter(ins => Math.abs(ins.netPremium) > 0.01);
  
  const creditTotal = credits.reduce((sum, ins) => sum + Math.abs(ins.netPremium), 0);
  const chargebackTotal = chargebacks.reduce((sum, ins) => sum + Math.abs(ins.netPremium), 0);

  const handleExportPNG = async () => {
    if (!statementRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(statementRef.current, { 
        quality: 1, 
        pixelRatio: 2,
        backgroundColor: "#ffffff"
      });
      const link = document.createElement("a");
      link.download = `commission-statement-${payout.teamMemberName.replace(/\s+/g, "-")}-${payout.periodMonth}-${payout.periodYear}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Error exporting PNG:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!statementRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(statementRef.current, { 
        quality: 1, 
        pixelRatio: 2,
        backgroundColor: "#ffffff"
      });
      
      const img = new window.Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      
      // Letter size: 8.5 x 11 inches = 612 x 792 points
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [img.width / 2, img.height / 2]
      });
      
      pdf.addImage(dataUrl, "PNG", 0, 0, img.width / 2, img.height / 2);
      pdf.save(`commission-statement-${payout.teamMemberName.replace(/\s+/g, "-")}-${payout.periodMonth}-${payout.periodYear}.pdf`);
    } catch (err) {
      console.error("Error exporting PDF:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Commission Statement</DialogTitle>
          <DialogDescription>
            Export statement for {payout.teamMemberName} - {periodLabel}
          </DialogDescription>
        </DialogHeader>

        {/* Export Buttons */}
        <div className="flex gap-2 mb-4">
          <Button onClick={handleExportPDF} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download PDF
          </Button>
          <Button variant="secondary" onClick={handleExportPNG} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4 mr-2" />
            )}
            Download PNG
          </Button>
        </div>

        {/* Statement Preview - Black & White, Printer-Friendly */}
        <div 
          ref={statementRef} 
          className="bg-white text-black p-8"
          style={{ 
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "12px",
            lineHeight: "1.4",
            minWidth: "650px"
          }}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="border-t-4 border-b-4 border-black py-2">
              <h1 className="text-xl font-bold tracking-wide">COMMISSION STATEMENT</h1>
            </div>
          </div>

          {/* Producer Info */}
          <div className="mb-6">
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="w-40">Producer:</td>
                  <td className="font-bold">{payout.teamMemberName}</td>
                </tr>
                <tr>
                  <td>Statement Period:</td>
                  <td className="font-bold">{periodLabel}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary Section */}
          <div className="mb-6">
            <div className="border-t-2 border-b border-black py-1 mb-3">
              <h2 className="font-bold text-center">SUMMARY</h2>
            </div>
            
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-1">Issued Premium Credits:</td>
                  <td className="text-right font-mono">{formatCurrency(payout.issuedPremium)}</td>
                </tr>
                <tr>
                  <td className="py-1">Chargebacks:</td>
                  <td className="text-right font-mono">-{formatCurrency(payout.chargebackPremium)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="border-b border-black"></td>
                </tr>
                <tr>
                  <td className="py-1 font-bold">Net Premium:</td>
                  <td className="text-right font-mono font-bold">{formatCurrency(payout.netPremium)}</td>
                </tr>
                <tr>
                  <td className="py-3"></td>
                  <td></td>
                </tr>
                <tr>
                  <td className="py-1">Written Premium Submitted:</td>
                  <td className="text-right font-mono">{formatCurrency(payout.writtenPremium)}</td>
                </tr>
                <tr>
                  <td className="py-1">Tier Achieved:</td>
                  <td className="text-right font-mono">
                    {payout.tierThresholdMet > 0 
                      ? `${formatCurrency(payout.tierThresholdMet)} (${payout.tierCommissionValue}%)` 
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="py-1">Base Commission:</td>
                  <td className="text-right font-mono">{formatCurrency(payout.baseCommission)}</td>
                </tr>
                {payout.bonusAmount > 0 && (
                  <tr>
                    <td className="py-1">Bonus:</td>
                    <td className="text-right font-mono">{formatCurrency(payout.bonusAmount)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} className="border-b border-black"></td>
                </tr>
                <tr>
                  <td className="py-1 font-bold text-lg">Commission Payout:</td>
                  <td className="text-right font-mono font-bold text-lg">{formatCurrency(payout.totalPayout)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Credits Section */}
          <div className="mb-6">
            <div className="border-t-2 border-b border-black py-1 mb-3">
              <h2 className="font-bold text-center">ISSUED PREMIUM CREDITS ({credits.length} {credits.length === 1 ? 'policy' : 'policies'})</h2>
            </div>
            
            {credits.length > 0 ? (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-400">
                      <th className="text-left py-1">Insured Name</th>
                      <th className="text-right py-1">Net Premium</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credits.map((ins, idx) => (
                      <tr key={`credit-${idx}`}>
                        <td className="py-0.5 truncate max-w-[400px]">{ins.insuredName}</td>
                        <td className="text-right font-mono">{formatCurrency(Math.abs(ins.netPremium))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-gray-400 mt-2 pt-1 flex justify-between font-bold">
                  <span>Credits Total:</span>
                  <span className="font-mono">{formatCurrency(creditTotal)}</span>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-500 py-4">No credits</p>
            )}
          </div>

          {/* Chargebacks Section */}
          <div className="mb-6">
            <div className="border-t-2 border-b border-black py-1 mb-3">
              <h2 className="font-bold text-center">CHARGEBACKS ({chargebacks.length} {chargebacks.length === 1 ? 'policy' : 'policies'})</h2>
            </div>
            
            {chargebacks.length > 0 ? (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-400">
                      <th className="text-left py-1">Insured Name</th>
                      <th className="text-right py-1">Net Premium</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chargebacks.map((ins, idx) => (
                      <tr key={`chargeback-${idx}`}>
                        <td className="py-0.5 truncate max-w-[400px]">{ins.insuredName}</td>
                        <td className="text-right font-mono">-{formatCurrency(Math.abs(ins.netPremium))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-gray-400 mt-2 pt-1 flex justify-between font-bold">
                  <span>Chargebacks Total:</span>
                  <span className="font-mono">-{formatCurrency(chargebackTotal)}</span>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-500 py-4">No chargebacks</p>
            )}
          </div>

          {/* Footer */}
          <div className="border-t-4 border-black pt-2 text-center text-xs text-gray-600">
            <p>Generated: {format(new Date(), "MMMM d, yyyy")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
