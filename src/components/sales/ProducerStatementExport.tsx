import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CompPayout } from "@/hooks/usePayoutCalculator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Download, Image as ImageIcon } from "lucide-react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { CalculationSnapshot, ChargebackDetail } from "@/lib/payout-calculator/types";

interface ProducerStatementExportProps {
  payout: CompPayout;
  agencyId: string | null;
  teamMemberName: string;
  onClose: () => void;
}

interface Agency {
  name: string;
  logo_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseChargebackDetails(value: unknown): ChargebackDetail[] {
  return Array.isArray(value) ? (value as ChargebackDetail[]) : [];
}

function parseCalculationSnapshot(value: unknown): CalculationSnapshot | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return value as CalculationSnapshot;
}

function getTierMetricLabel(tierMetric: string | undefined): string {
  switch (tierMetric) {
    case "premium":
      return "written premium";
    case "policies":
      return "written policies";
    case "households":
      return "written households";
    case "points":
      return "written points";
    case "items":
    default:
      return "written items";
  }
}

function getTierMetricValue(payout: CompPayout, tierMetric: string | undefined): string {
  switch (tierMetric) {
    case "premium":
      return formatCurrency(payout.written_premium || 0);
    case "policies":
      return String(payout.written_policies || 0);
    case "households":
      return String(payout.written_households || 0);
    case "points":
      return String(payout.written_points || 0);
    case "items":
    default:
      return String(payout.written_items || 0);
  }
}

function getTierSourceLabel(snapshot: CalculationSnapshot | null): string {
  if (snapshot?.inputs.tierQualificationSource === "manual_override") {
    return "manual fallback entry";
  }
  if (snapshot?.inputs.tierQualificationSource === "sales_table") {
    return "sales dashboard";
  }
  if (snapshot?.inputs.tierMetricSource === "issued") {
    return "issued statement";
  }
  return "statement fallback";
}

export function ProducerStatementExport({ 
  payout, 
  agencyId, 
  teamMemberName,
  onClose 
}: ProducerStatementExportProps) {
  const statementRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const chargebackDetails = parseChargebackDetails(payout.chargeback_details_json);
  const calculationSnapshot = parseCalculationSnapshot(payout.calculation_snapshot_json);
  const hasChargebackAudit = chargebackDetails.length > 0;
  const appliedChargebacks = chargebackDetails.filter((detail) => detail.included);
  const excludedChargebacks = chargebackDetails.filter((detail) => !detail.included);
  const appliedChargebackPremium = hasChargebackAudit
    ? appliedChargebacks.reduce((sum, detail) => sum + detail.premium, 0)
    : Math.abs(payout.chargeback_premium || 0);
  const excludedChargebackPremium = hasChargebackAudit
    ? excludedChargebacks.reduce((sum, detail) => sum + detail.premium, 0)
    : 0;
  const netPremiumPaidOn = hasChargebackAudit
    ? (payout.issued_premium || 0) - appliedChargebackPremium
    : (payout.net_premium ?? ((payout.issued_premium || 0) - appliedChargebackPremium));
  const appliedChargebackCount = hasChargebackAudit
    ? appliedChargebacks.length
    : (payout.chargeback_count || 0);
  const tierMetric = calculationSnapshot?.inputs.tierMetric;
  const tierMetricLabel = getTierMetricLabel(tierMetric);
  const tierMetricValue = getTierMetricValue(payout, tierMetric);
  const tierThresholdDisplay = payout.tier_commission_value != null
    ? tierMetric === "premium"
      ? formatCurrency(payout.tier_threshold_met || 0)
      : `${payout.tier_threshold_met || 0} ${tierMetricLabel.replace("written ", "")}`
    : "—";

  // Fetch agency details
  const { data: agency, isLoading: agencyLoading } = useQuery<Agency | null>({
    queryKey: ["agency-for-statement", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("name, logo_url, address_line1, address_line2, address_city, address_state, address_zip")
        .eq("id", agencyId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const periodLabel = `${MONTHS[payout.period_month - 1]} ${payout.period_year}`;

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "finalized":
        return <Badge variant="default">Finalized</Badge>;
      case "paid":
        return <Badge className="bg-green-600 text-white">Paid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatAddress = () => {
    if (!agency) return null;
    const parts = [];
    if (agency.address_line1) parts.push(agency.address_line1);
    if (agency.address_line2) parts.push(agency.address_line2);
    const cityStateZip = [
      agency.address_city,
      agency.address_state,
      agency.address_zip
    ].filter(Boolean).join(", ");
    if (cityStateZip) parts.push(cityStateZip);
    return parts;
  };

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
      link.download = `statement-${teamMemberName.replace(/\s+/g, "-")}-${payout.period_month}-${payout.period_year}.png`;
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
      
      const pdf = new jsPDF({
        orientation: img.width > img.height ? "landscape" : "portrait",
        unit: "px",
        format: [img.width / 2, img.height / 2]
      });
      
      pdf.addImage(dataUrl, "PNG", 0, 0, img.width / 2, img.height / 2);
      pdf.save(`statement-${teamMemberName.replace(/\s+/g, "-")}-${payout.period_month}-${payout.period_year}.pdf`);
    } catch (err) {
      console.error("Error exporting PDF:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Commission Statement</DialogTitle>
          <DialogDescription>
            Export statement for {teamMemberName} - {periodLabel}
          </DialogDescription>
        </DialogHeader>

        {agencyLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
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

            {/* Statement Preview */}
            <div 
              ref={statementRef} 
              className="bg-white text-black p-6 rounded-lg border"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  {agency?.logo_url && (
                    <img src={agency.logo_url} alt="Agency Logo" className="h-12 mb-2" />
                  )}
                  <h2 className="text-xl font-bold text-gray-900">{agency?.name || "Agency"}</h2>
                  {formatAddress()?.map((line, i) => (
                    <p key={i} className="text-sm text-gray-600">{line}</p>
                  ))}
                </div>
                <div className="text-right">
                  <h1 className="text-2xl font-bold text-gray-900">Commission Statement</h1>
                  <p className="text-lg text-gray-700">{periodLabel}</p>
                  <div className="mt-2">{getStatusBadge(payout.status)}</div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Team Member Info */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">{teamMemberName}</h3>
                <p className="text-sm text-gray-600">Statement Period: {periodLabel}</p>
                {payout.finalized_at && (
                  <p className="text-sm text-gray-600">
                    Finalized: {format(new Date(payout.finalized_at), "MMM d, yyyy")}
                  </p>
                )}
                {payout.paid_at && (
                  <p className="text-sm text-gray-600">
                    Paid: {format(new Date(payout.paid_at), "MMM d, yyyy")}
                  </p>
                )}
              </div>

              {/* Performance Metrics */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Performance Metrics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-gray-50">
                    <CardContent className="p-4">
                      <h5 className="text-sm font-medium text-gray-600 mb-2">Written Production</h5>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Premium:</span>
                          <span className="font-medium">${(payout.written_premium || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Items:</span>
                          <span className="font-medium">{payout.written_items || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Policies:</span>
                          <span className="font-medium">{payout.written_policies || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Households:</span>
                          <span className="font-medium">{payout.written_households || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Points:</span>
                          <span className="font-medium">{payout.written_points || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-50">
                    <CardContent className="p-4">
                      <h5 className="text-sm font-medium text-gray-600 mb-2">Issued Production</h5>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Premium:</span>
                          <span className="font-medium">${(payout.issued_premium || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Items:</span>
                          <span className="font-medium">{payout.issued_items || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Policies:</span>
                          <span className="font-medium">{payout.issued_policies || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Points:</span>
                          <span className="font-medium">{payout.issued_points || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Chargebacks & Net */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Card className="bg-red-50">
                    <CardContent className="p-4">
                      <h5 className="text-sm font-medium text-red-700 mb-2">Chargebacks Applied</h5>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Premium:</span>
                          <span className="font-medium text-red-700">
                            -{formatCurrency(appliedChargebackPremium)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Count:</span>
                          <span className="font-medium text-red-700">{appliedChargebackCount}</span>
                        </div>
                        {hasChargebackAudit && excludedChargebacks.length > 0 && (
                          <div className="flex justify-between text-amber-700">
                            <span>Excluded:</span>
                            <span className="font-medium">-{formatCurrency(excludedChargebackPremium)}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-green-50">
                    <CardContent className="p-4">
                      <h5 className="text-sm font-medium text-green-700 mb-2">Net Premium Paid On</h5>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Premium:</span>
                          <span className="font-medium text-green-700">
                            {formatCurrency(netPremiumPaidOn)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Items:</span>
                          <span className="font-medium text-green-700">{payout.net_items || 0}</span>
                        </div>
                      </div>
                  </CardContent>
                </Card>
              </div>
              {!hasChargebackAudit && (payout.chargeback_premium || 0) > 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  Detailed chargeback inclusion data was not saved for this historical payout, so this statement falls back to the stored summary totals.
                </p>
              )}
              </div>

              <Separator className="my-4" />

              {/* Commission Calculation */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Commission Calculation</h4>
                <Card className="bg-blue-50">
                  <CardContent className="p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Tier Qualification Input:</span>
                        <span className="font-medium">{tierMetricValue} ({tierMetricLabel})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tier Achieved:</span>
                        <span className="font-medium">{tierThresholdDisplay}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Commission Rate:</span>
                        <span className="font-medium">
                          {payout.tier_commission_value != null 
                            ? `${payout.tier_commission_value}%` 
                            : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tier Source:</span>
                        <span className="font-medium">{getTierSourceLabel(calculationSnapshot)}</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between">
                        <span>Base Commission:</span>
                        <span className="font-medium">{formatCurrency(payout.base_commission || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bonus Amount:</span>
                        <span className="font-medium">{formatCurrency(payout.bonus_amount || 0)}</span>
                      </div>
                      {payout.rollover_premium != null && payout.rollover_premium !== 0 && (
                        <div className="flex justify-between">
                          <span>Rollover Premium:</span>
                          <span className="font-medium">{formatCurrency(payout.rollover_premium)}</span>
                        </div>
                      )}
                      <Separator className="my-2" />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total Payout:</span>
                        <span className="text-green-700">{formatCurrency(payout.total_payout || 0)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Footer */}
              <div className="text-center text-xs text-gray-500 mt-6">
                <p>Generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
