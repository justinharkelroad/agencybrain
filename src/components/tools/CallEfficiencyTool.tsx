import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, FileText, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { parseCallLogCSV, ParsedCallLog } from "@/utils/callLogParser";
import { calculateCallEfficiency, CallEfficiencyResults } from "@/utils/callEfficiencyCalculator";
import { format } from "date-fns";
import CallEfficiencyReportCard from "./CallEfficiencyReportCard";

interface CallEfficiencyToolProps {
  onBack: () => void;
}

const THRESHOLD_OPTIONS = [
  { value: "2", label: "2 minutes" },
  { value: "3", label: "3 minutes" },
  { value: "4", label: "4 minutes" },
  { value: "5", label: "5 minutes" },
  { value: "10", label: "10 minutes" },
  { value: "20", label: "20 minutes" },
];

export function CallEfficiencyTool({ onBack }: CallEfficiencyToolProps) {
  const [parsedData, setParsedData] = useState<ParsedCallLog | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [threshold, setThreshold] = useState<string>("2");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [results, setResults] = useState<CallEfficiencyResults | null>(null);
  const [showReport, setShowReport] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCallLogCSV(text);
      setParsedData(parsed);
      
      // Set default date range from parsed data
      if (parsed.dateRange.start && parsed.dateRange.end) {
        setStartDate(format(parsed.dateRange.start, "yyyy-MM-dd"));
        setEndDate(format(parsed.dateRange.end, "yyyy-MM-dd"));
      }
      
      // Clear previous results
      setResults(null);
      setShowReport(false);
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
    maxFiles: 1,
  });

  const handleGenerateReport = () => {
    if (!parsedData) return;

    const dateFilter = startDate && endDate
      ? { start: new Date(startDate), end: new Date(endDate) }
      : undefined;

    const calculatedResults = calculateCallEfficiency(
      parsedData.calls,
      parseInt(threshold),
      dateFilter
    );
    setResults(calculatedResults);
    setShowReport(true);
  };

  const handleClearFile = () => {
    setParsedData(null);
    setFileName("");
    setResults(null);
    setShowReport(false);
    setStartDate("");
    setEndDate("");
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case "ringcentral": return "RingCentral";
      case "ricochet": return "Ricochet";
      default: return "Generic CSV";
    }
  };

  if (showReport && results && parsedData) {
    return (
      <CallEfficiencyReportCard
        results={results}
        parsedData={parsedData}
        onClose={() => setShowReport(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to tools">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-medium text-muted-foreground">Call Efficiency Tool</h3>
        </div>
      </div>

      {/* Upload Section */}
      <Card className="p-6">
        <h4 className="text-sm font-medium mb-4">Upload Call Log CSV</h4>
        
        {!parsedData ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-sm text-muted-foreground">Drop the CSV file here...</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-1">
                  Drag & drop a CSV file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports RingCentral, Ricochet, and generic call log formats
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Info */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    Detected format: <span className="font-medium">{getFormatLabel(parsedData.format)}</span>
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Parse Status */}
            <div className="flex items-start gap-2 p-3 bg-emerald-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-emerald-500">Successfully parsed</p>
                <p className="text-muted-foreground">
                  {parsedData.calls.length} calls found • {parsedData.users.length} user{parsedData.users.length !== 1 ? "s" : ""} detected
                </p>
                {parsedData.dateRange.start && parsedData.dateRange.end && (
                  <p className="text-muted-foreground">
                    Date range: {format(parsedData.dateRange.start, "MMM d, yyyy")} → {format(parsedData.dateRange.end, "MMM d, yyyy")}
                  </p>
                )}
              </div>
            </div>

            {/* Parse Errors */}
            {parsedData.parseErrors.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-500">Parse warnings</p>
                  <ul className="text-muted-foreground list-disc list-inside">
                    {parsedData.parseErrors.slice(0, 5).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                    {parsedData.parseErrors.length > 5 && (
                      <li>...and {parsedData.parseErrors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Controls Section */}
      {parsedData && parsedData.calls.length > 0 && (
        <Card className="p-6">
          <h4 className="text-sm font-medium mb-4">Report Settings</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Duration Threshold */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Duration Threshold</label>
              <Select value={threshold} onValueChange={setThreshold}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THRESHOLD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          <Button
            onClick={handleGenerateReport}
            className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={!parsedData || parsedData.calls.length === 0}
          >
            Generate Report
          </Button>
        </Card>
      )}
    </div>
  );
}

export default CallEfficiencyTool;
