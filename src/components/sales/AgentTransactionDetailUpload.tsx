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
import { Upload, FileSpreadsheet, X, CheckCircle, AlertTriangle, Plus } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  parseCompensationStatement,
  ParsedStatement,
  StatementTransaction,
} from "@/lib/allstate-parser/excel-parser";
import { analyzeSubProducers, SubProducerMetrics } from "@/lib/allstate-analyzer/sub-producer-analyzer";

interface UploadedFile {
  id: string;
  fileName: string;
  agentNumber: string;
  transactionCount: number;
  statement: ParsedStatement;
}

interface AgentTransactionDetailUploadProps {
  onDataParsed: (
    aggregatedMetrics: SubProducerMetrics[],
    allTransactions: StatementTransaction[]
  ) => void;
}

export function AgentTransactionDetailUpload({ onDataParsed }: AgentTransactionDetailUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Aggregate and analyze all transactions across uploaded files
  const aggregateAndAnalyze = useCallback((files: UploadedFile[]) => {
    // Combine all transactions from all files
    const allTransactions: StatementTransaction[] = [];
    for (const file of files) {
      allTransactions.push(...file.statement.transactions);
    }

    if (allTransactions.length === 0) {
      onDataParsed([], []);
      return;
    }

    // Use the sub-producer analyzer to get metrics
    const analysis = analyzeSubProducers(allTransactions);

    console.log(`[AgentTransactionDetailUpload] Aggregated ${allTransactions.length} transactions from ${files.length} files`);
    console.log(`[AgentTransactionDetailUpload] Found ${analysis.producers.length} sub-producers`);

    onDataParsed(analysis.producers, allTransactions);
  }, [onDataParsed]);

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setErrors([]);

      try {
        const result = await parseCompensationStatement(file);

        if (result.parseErrors.length > 0 && result.transactions.length === 0) {
          setErrors(result.parseErrors);
          toast.error("Failed to parse file");
          return;
        }

        // Check if this agent number already exists
        const existingIndex = uploadedFiles.findIndex(
          f => f.agentNumber === result.agentNumber
        );

        const newFile: UploadedFile = {
          id: `${result.agentNumber}-${Date.now()}`,
          fileName: file.name,
          agentNumber: result.agentNumber || "Unknown",
          transactionCount: result.transactions.length,
          statement: result,
        };

        let updatedFiles: UploadedFile[];

        if (existingIndex >= 0) {
          // Replace existing file for this agent
          updatedFiles = [...uploadedFiles];
          updatedFiles[existingIndex] = newFile;
          toast.info(`Updated data for agent ${result.agentNumber}`);
        } else {
          // Add new file
          updatedFiles = [...uploadedFiles, newFile];
          toast.success(`Added ${result.transactions.length} transactions from agent ${result.agentNumber}`);
        }

        setUploadedFiles(updatedFiles);
        aggregateAndAnalyze(updatedFiles);

        if (result.parseErrors.length > 0) {
          setErrors(result.parseErrors);
        }
      } catch (err) {
        console.error("Error processing file:", err);
        setErrors([err instanceof Error ? err.message : "Failed to process file"]);
        toast.error("Failed to process file");
      } finally {
        setIsProcessing(false);
      }
    },
    [uploadedFiles, aggregateAndAnalyze]
  );

  const removeFile = useCallback((fileId: string) => {
    const updatedFiles = uploadedFiles.filter(f => f.id !== fileId);
    setUploadedFiles(updatedFiles);
    aggregateAndAnalyze(updatedFiles);
    toast.info("File removed");
  }, [uploadedFiles, aggregateAndAnalyze]);

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

  // Calculate totals across all files
  const totals = uploadedFiles.reduce(
    (acc, file) => ({
      transactions: acc.transactions + file.transactionCount,
      writtenPremium: acc.writtenPremium + file.statement.totals.writtenPremium,
      totalCommission: acc.totalCommission + file.statement.totals.totalCommission,
    }),
    { transactions: 0, writtenPremium: 0, totalCommission: 0 }
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-4 w-4" />
          Agent Transaction Detail (Chargebacks)
        </CardTitle>
        <CardDescription className="text-xs">
          Upload "Agent Transaction Detail" reports - add multiple files for multi-agency setups
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-amber-500 bg-amber-50"
              : "border-amber-300 hover:border-amber-400 bg-amber-50/30"
          } ${isProcessing ? "opacity-50 cursor-wait" : ""}`}
        >
          <input {...getInputProps()} />
          {uploadedFiles.length > 0 ? (
            <Plus className="h-6 w-6 mx-auto mb-1 text-amber-500" />
          ) : (
            <Upload className="h-6 w-6 mx-auto mb-1 text-amber-500" />
          )}
          {isProcessing ? (
            <p className="text-xs text-muted-foreground">Processing file...</p>
          ) : isDragActive ? (
            <p className="text-xs text-amber-600 font-medium">Drop the file here...</p>
          ) : (
            <div>
              <p className="text-xs font-medium text-amber-700">
                {uploadedFiles.length > 0
                  ? "Add another Agent Transaction Detail file"
                  : "Drop Agent Transaction Detail report here"}
              </p>
              <p className="text-xs text-muted-foreground">
                (.xlsx) - Has chargebacks with sub-producer codes
              </p>
            </div>
          )}
        </div>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Uploaded Files ({uploadedFiles.length})
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Agent #</TableHead>
                    <TableHead className="text-xs">File</TableHead>
                    <TableHead className="text-xs text-right">Transactions</TableHead>
                    <TableHead className="text-xs text-right">Premium</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadedFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="text-xs font-mono">
                        <Badge variant="outline" className="text-xs">
                          {file.agentNumber}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]">
                        {file.fileName}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {file.transactionCount}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {formatCurrency(file.statement.totals.writtenPremium)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => removeFile(file.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals Summary */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="secondary" className="text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                {totals.transactions} total transactions
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {formatCurrency(totals.writtenPremium)} premium
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {formatCurrency(totals.totalCommission)} commission
              </Badge>
            </div>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 text-xs">
                {errors.slice(0, 5).map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
                {errors.length > 5 && (
                  <li>...and {errors.length - 5} more errors</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Help Text */}
        {uploadedFiles.length === 0 && (
          <p className="text-xs text-muted-foreground">
            This report includes chargebacks with sub-producer codes, enabling accurate
            chargeback attribution. Upload multiple files if you have multiple agencies.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
