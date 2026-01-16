import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Upload, FileSpreadsheet, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Users, Database, Loader2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  parseNewBusinessDetails,
  SubProducerSalesMetrics,
  NewBusinessParseResult,
} from "@/lib/new-business-details-parser";
import { useSyncSalesToLqs } from "@/hooks/useSyncSalesToLqs";

interface TeamMember {
  id: string;
  name: string;
  sub_producer_code: string | null;
}

interface SalesReportUploadProps {
  agencyId: string | null;
  teamMembers: TeamMember[];
  onDataParsed: (metrics: SubProducerSalesMetrics[], result: NewBusinessParseResult) => void;
}

export function SalesReportUpload({ agencyId, teamMembers, onDataParsed }: SalesReportUploadProps) {
  const [parseResult, setParseResult] = useState<NewBusinessParseResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    synced: boolean;
    newSalesCreated: number;
    existingInLqs: number;
  } | null>(null);

  const { syncSales, isSyncing, progress } = useSyncSalesToLqs(agencyId);

  // Build lookup map for team members by sub-producer code
  const memberByCode = new Map<string, TeamMember>();
  teamMembers.forEach((tm) => {
    if (tm.sub_producer_code) {
      memberByCode.set(tm.sub_producer_code.trim(), tm);
    }
  });

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setFileName(file.name);
      setSyncResult(null); // Reset sync result when processing new file

      try {
        const buffer = await file.arrayBuffer();
        const result = parseNewBusinessDetails(buffer);

        setParseResult(result);

        if (result.success && result.subProducerMetrics.length > 0) {
          onDataParsed(result.subProducerMetrics, result);
          setIsExpanded(true);
        }
      } catch (err) {
        console.error("Error processing file:", err);
        setParseResult({
          success: false,
          records: [],
          subProducerMetrics: [],
          errors: [err instanceof Error ? err.message : "Failed to process file"],
          dateRange: null,
          summary: {
            totalRecords: 0,
            totalItems: 0,
            totalPremium: 0,
            totalPolicies: 0,
            subProducerCount: 0,
            endorsementsSkipped: 0,
            chargebackRecords: 0,
            chargebackItems: 0,
            chargebackPremium: 0,
            netPremium: 0,
          },
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [onDataParsed]
  );

  const handleSyncToLqs = useCallback(async () => {
    if (!parseResult?.records || parseResult.records.length === 0) {
      toast.error("No records to sync");
      return;
    }

    const result = await syncSales(parseResult.records, teamMembers);

    setSyncResult({
      synced: true,
      newSalesCreated: result.newSalesCreated,
      existingInLqs: result.existingInLqs,
    });

    if (result.success) {
      if (result.newSalesCreated > 0) {
        toast.success(`Synced ${result.newSalesCreated} new sales to LQS`);
      } else {
        toast.info("All sales already exist in LQS");
      }
    } else {
      toast.error(`Sync completed with errors: ${result.errors.join(", ")}`);
    }
  }, [parseResult, teamMembers, syncSales]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        processFile(acceptedFiles[0]);
      }
    },
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    disabled: isProcessing,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getMatchStatus = (code: string | null) => {
    if (!code) return { matched: false, member: null };
    const member = memberByCode.get(code);
    return { matched: !!member, member };
  };

  // Calculate match stats
  const matchStats = parseResult?.subProducerMetrics
    ? {
        total: parseResult.subProducerMetrics.length,
        matched: parseResult.subProducerMetrics.filter((m) => getMatchStatus(m.code).matched).length,
        unmatched: parseResult.subProducerMetrics.filter(
          (m) => m.code !== "UNASSIGNED" && !getMatchStatus(m.code).matched
        ).length,
      }
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Sales Report Upload
        </CardTitle>
        <CardDescription>
          Upload the "New Business Details" report from Allstate to calculate compensation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          } ${isProcessing ? "opacity-50 cursor-wait" : ""}`}
        >
          <input {...getInputProps()} />
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          {isProcessing ? (
            <p className="text-sm text-muted-foreground">Processing file...</p>
          ) : isDragActive ? (
            <p className="text-sm text-primary">Drop the file here...</p>
          ) : (
            <div>
              <p className="text-sm font-medium">
                Drag & drop your New Business Details report here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to select file (.xlsx)
              </p>
            </div>
          )}
        </div>

        {/* Parse Result */}
        {parseResult && (
          <>
            {/* Success State */}
            {parseResult.success && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {fileName}
                  </Badge>
                  {parseResult.dateRange && (
                    <Badge variant="secondary">
                      {parseResult.dateRange.start} to {parseResult.dateRange.end}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {parseResult.summary.totalRecords} records
                  </Badge>
                  <Badge variant="outline">
                    {parseResult.summary.totalItems} items
                  </Badge>
                  <Badge variant="outline">
                    {formatCurrency(parseResult.summary.totalPremium)}
                  </Badge>
                </div>

                {/* Match Stats */}
                {matchStats && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">Sub-Producers:</span>
                    <Badge variant="default">
                      <Users className="h-3 w-3 mr-1" />
                      {matchStats.matched} matched
                    </Badge>
                    {matchStats.unmatched > 0 && (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {matchStats.unmatched} unmatched
                      </Badge>
                    )}
                  </div>
                )}

                {/* LQS Sync Section */}
                <div className="flex items-center gap-3 pt-2 border-t mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncToLqs}
                    disabled={isSyncing || syncResult?.synced}
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : syncResult?.synced ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        Synced to LQS
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Sync to LQS
                      </>
                    )}
                  </Button>
                  {syncResult && (
                    <span className="text-xs text-muted-foreground">
                      {syncResult.newSalesCreated > 0
                        ? `${syncResult.newSalesCreated} new sales added`
                        : `${syncResult.existingInLqs} already in LQS`}
                    </span>
                  )}
                  {isSyncing && progress && (
                    <div className="flex-1 max-w-xs">
                      <Progress
                        value={(progress.current / Math.max(progress.total, 1)) * 100}
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{progress.message}</p>
                    </div>
                  )}
                </div>

                {/* Expandable Details */}
                <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 mr-2" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mr-2" />
                      )}
                      View Sub-Producer Breakdown
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Sub-Producer</TableHead>
                            <TableHead>Team Member</TableHead>
                            <TableHead className="text-right">Items</TableHead>
                            <TableHead className="text-right">Policies</TableHead>
                            <TableHead className="text-right">Premium</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parseResult.subProducerMetrics.map((metrics) => {
                            const { matched, member } = getMatchStatus(metrics.code);
                            return (
                              <TableRow
                                key={metrics.code}
                                className={!matched && metrics.code !== "UNASSIGNED" ? "bg-red-50/50" : ""}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono text-xs">
                                      {metrics.code}
                                    </Badge>
                                    {metrics.name && (
                                      <span className="text-sm text-muted-foreground">
                                        {metrics.name}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {matched ? (
                                    <span className="font-medium text-green-700">{member?.name}</span>
                                  ) : metrics.code === "UNASSIGNED" ? (
                                    <span className="text-muted-foreground italic">Unassigned</span>
                                  ) : (
                                    <span className="text-red-600 italic">Not matched</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {metrics.totalItems}
                                </TableCell>
                                <TableCell className="text-right">
                                  {metrics.totalPolicies}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(metrics.totalPremium)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Product Breakdown (if available) */}
                    {parseResult.subProducerMetrics.some((m) => m.byProduct.length > 0) && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Products Breakdown</h4>
                        <div className="text-xs text-muted-foreground">
                          {(() => {
                            const productTotals = new Map<string, { items: number; premium: number }>();
                            parseResult.subProducerMetrics.forEach((m) => {
                              m.byProduct.forEach((p) => {
                                const existing = productTotals.get(p.product) || {
                                  items: 0,
                                  premium: 0,
                                };
                                existing.items += p.items;
                                existing.premium += p.premium;
                                productTotals.set(p.product, existing);
                              });
                            });
                            return Array.from(productTotals.entries()).map(([product, data]) => (
                              <Badge key={product} variant="secondary" className="mr-2 mb-1">
                                {product}: {data.items} items ({formatCurrency(data.premium)})
                              </Badge>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {/* Warnings about skipped records */}
                {parseResult.summary.endorsementsSkipped > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {parseResult.summary.endorsementsSkipped} endorsement/add-item records were skipped
                      (only "New Policy Issued" records are included in compensation).
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Error State */}
            {!parseResult.success && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {parseResult.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Help Text */}
        {!parseResult && (
          <p className="text-xs text-muted-foreground">
            This report provides item counts and premium data needed for accurate tier matching
            in compensation calculations. Download it from Allstate's reporting system.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
