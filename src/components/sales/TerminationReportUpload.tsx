import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Upload, FileSpreadsheet, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Car, Home } from "lucide-react";
import { useDropzone } from "react-dropzone";
import {
  parseBOBTerminationReport,
  TerminationRecord,
  TerminationParseResult,
} from "@/lib/bob-termination-parser";

interface TerminationReportUploadProps {
  onDataParsed: (records: TerminationRecord[], result: TerminationParseResult) => void;
}

export function TerminationReportUpload({ onDataParsed }: TerminationReportUploadProps) {
  const [parseResult, setParseResult] = useState<TerminationParseResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setFileName(file.name);

      try {
        const buffer = await file.arrayBuffer();
        const result = parseBOBTerminationReport(buffer);

        setParseResult(result);

        if (result.success && result.records.length > 0) {
          onDataParsed(result.records, result);
          setIsExpanded(true);
        }
      } catch (err) {
        console.error("Error processing termination file:", err);
        setParseResult({
          success: false,
          records: [],
          errors: [err instanceof Error ? err.message : "Failed to process file"],
          dateRange: null,
          summary: {
            totalRecords: 0,
            totalPremium: 0,
            autoTerminations: 0,
            propertyTerminations: 0,
          },
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [onDataParsed]
  );

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

  // Group terminations by reason
  const terminationsByReason = parseResult?.records.reduce((acc, rec) => {
    const reason = rec.terminationReason || "Unknown";
    if (!acc[reason]) {
      acc[reason] = { count: 0, premium: 0 };
    }
    acc[reason].count++;
    acc[reason].premium += rec.premiumNew;
    return acc;
  }, {} as Record<string, { count: number; premium: number }>);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-4 w-4" />
          Termination Report (Chargebacks)
        </CardTitle>
        <CardDescription className="text-xs">
          Upload the "BOB Termination Audit Report" from Allstate
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          } ${isProcessing ? "opacity-50 cursor-wait" : ""}`}
        >
          <input {...getInputProps()} />
          <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
          {isProcessing ? (
            <p className="text-xs text-muted-foreground">Processing file...</p>
          ) : isDragActive ? (
            <p className="text-xs text-primary">Drop the file here...</p>
          ) : (
            <div>
              <p className="text-xs font-medium">
                Drop BOB Termination Audit Report here
              </p>
              <p className="text-xs text-muted-foreground">
                (.xlsx)
              </p>
            </div>
          )}
        </div>

        {/* Parse Result */}
        {parseResult && (
          <>
            {/* Success State */}
            {parseResult.success && (
              <div className="space-y-3">
                {/* Summary */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {fileName}
                  </Badge>
                  {parseResult.dateRange && (
                    <Badge variant="secondary" className="text-xs">
                      {parseResult.dateRange.start} to {parseResult.dateRange.end}
                    </Badge>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted">
                    <div className="text-muted-foreground">Terminations</div>
                    <div className="font-bold">{parseResult.summary.totalRecords}</div>
                  </div>
                  <div className="p-2 rounded bg-muted">
                    <div className="text-muted-foreground">Total Premium</div>
                    <div className="font-bold text-red-600">{formatCurrency(parseResult.summary.totalPremium)}</div>
                  </div>
                  <div className="p-2 rounded bg-muted flex items-center gap-1">
                    <Car className="h-3 w-3 text-blue-500" />
                    <div>
                      <div className="text-muted-foreground">Auto</div>
                      <div className="font-bold">{parseResult.summary.autoTerminations}</div>
                    </div>
                  </div>
                  <div className="p-2 rounded bg-muted flex items-center gap-1">
                    <Home className="h-3 w-3 text-amber-500" />
                    <div>
                      <div className="text-muted-foreground">Property</div>
                      <div className="font-bold">{parseResult.summary.propertyTerminations}</div>
                    </div>
                  </div>
                </div>

                {/* Expandable Details */}
                <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7">
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 mr-1" />
                      ) : (
                        <ChevronRight className="h-3 w-3 mr-1" />
                      )}
                      View Termination Details
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    {/* By Termination Reason */}
                    {terminationsByReason && Object.keys(terminationsByReason).length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-xs font-medium mb-2">By Termination Reason</h4>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(terminationsByReason)
                            .sort((a, b) => b[1].count - a[1].count)
                            .slice(0, 8)
                            .map(([reason, data]) => (
                              <Badge key={reason} variant="outline" className="text-xs">
                                {reason}: {data.count} ({formatCurrency(data.premium)})
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Terminations Table */}
                    <div className="rounded-md border max-h-60 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Policy #</TableHead>
                            <TableHead className="text-xs">Insured</TableHead>
                            <TableHead className="text-xs">Product</TableHead>
                            <TableHead className="text-xs">Term Date</TableHead>
                            <TableHead className="text-xs text-right">Premium</TableHead>
                            <TableHead className="text-xs text-right">Days</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parseResult.records.slice(0, 20).map((rec, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-xs font-mono">
                                {rec.policyNumber}
                              </TableCell>
                              <TableCell className="text-xs">
                                {rec.insuredName}
                              </TableCell>
                              <TableCell className="text-xs">
                                <Badge variant={rec.isAutoProduct ? "default" : "secondary"} className="text-xs px-1 py-0">
                                  {rec.isAutoProduct ? "Auto" : "Property"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {rec.terminationEffectiveDate}
                              </TableCell>
                              <TableCell className="text-xs text-right text-red-600">
                                {formatCurrency(rec.premiumNew)}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                {rec.daysInForce !== null ? (
                                  <span className={rec.daysInForce < 90 ? "text-red-600 font-medium" : ""}>
                                    {rec.daysInForce}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {parseResult.records.length > 20 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Showing 20 of {parseResult.records.length} terminations
                      </p>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Error State */}
            {!parseResult.success && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 text-xs">
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
            This report provides policy terminations for chargeback calculations.
            Chargebacks are applied based on days in force (90/180/365 day rules).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
