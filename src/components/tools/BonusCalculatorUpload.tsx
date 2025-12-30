import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, Image, Upload, X, Check, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { parseBusinessMetrics, validateBusinessMetricsExtraction, type BusinessMetricsExtraction } from '@/utils/businessMetricsParser';
import { parseBonusQualifiers, validateBonusQualifiersExtraction, type BonusQualifiersExtraction } from '@/utils/bonusQualifiersParser';

type UploadStatus = 'empty' | 'selected' | 'processing' | 'success' | 'error';

interface BonusCalculatorUploadProps {
  onExtractionComplete: (
    metricsData: BusinessMetricsExtraction | null,
    qualifiersData: BonusQualifiersExtraction | null
  ) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function BonusCalculatorUpload({ onExtractionComplete }: BonusCalculatorUploadProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Business Metrics state
  const [metricsFile, setMetricsFile] = useState<File | null>(null);
  const [metricsStatus, setMetricsStatus] = useState<UploadStatus>('empty');
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsResult, setMetricsResult] = useState<BusinessMetricsExtraction | null>(null);
  
  // Bonus Qualifiers state
  const [qualifiersFile, setQualifiersFile] = useState<File | null>(null);
  const [qualifiersStatus, setQualifiersStatus] = useState<UploadStatus>('empty');
  const [qualifiersError, setQualifiersError] = useState<string | null>(null);
  const [qualifiersResult, setQualifiersResult] = useState<BonusQualifiersExtraction | null>(null);
  
  const [isExtracting, setIsExtracting] = useState(false);

  // Metrics dropzone - XLSX only (no PDF support)
  const onMetricsDrop = useCallback((acceptedFiles: File[], rejectedFiles: unknown[]) => {
    if (rejectedFiles.length > 0) {
      const file = (rejectedFiles[0] as any)?.file;
      if (file?.type === 'application/pdf' || file?.name?.endsWith('.pdf')) {
        setMetricsError('PDF files are not supported. Please download your Business Metrics report as XLSX from the Allstate portal.');
      } else {
        setMetricsError('Please upload an XLSX file for Business Metrics');
      }
      return;
    }
    
    const file = acceptedFiles[0];
    if (!file) return;
    
    if (file.size > MAX_FILE_SIZE) {
      setMetricsError('File is too large. Maximum size is 10MB');
      return;
    }
    
    setMetricsFile(file);
    setMetricsStatus('selected');
    setMetricsError(null);
    setMetricsResult(null);
  }, []);

  const metricsDropzone = useDropzone({
    onDrop: onMetricsDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
  });

  // Qualifiers dropzone
  const onQualifiersDrop = useCallback((acceptedFiles: File[], rejectedFiles: unknown[]) => {
    if (rejectedFiles.length > 0) {
      setQualifiersError('Please upload a PNG, JPG, or PDF file for Bonus Qualifiers');
      return;
    }
    
    const file = acceptedFiles[0];
    if (!file) return;
    
    if (file.size > MAX_FILE_SIZE) {
      setQualifiersError('File is too large. Maximum size is 10MB');
      return;
    }
    
    setQualifiersFile(file);
    setQualifiersStatus('selected');
    setQualifiersError(null);
    setQualifiersResult(null);
  }, []);

  const qualifiersDropzone = useDropzone({
    onDrop: onQualifiersDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
  });

  const handleExtract = async () => {
    if (!metricsFile && !qualifiersFile) {
      toast.error('Please select at least one file to extract data from');
      return;
    }
    
    setIsExtracting(true);
    let extractedMetrics: BusinessMetricsExtraction | null = null;
    let extractedQualifiers: BonusQualifiersExtraction | null = null;
    
    try {
      // Process Business Metrics
      if (metricsFile) {
        setMetricsStatus('processing');
        try {
          extractedMetrics = await parseBusinessMetrics(metricsFile);
          
          if (extractedMetrics) {
            const validation = validateBusinessMetricsExtraction(extractedMetrics);
            if (validation.isValid) {
              setMetricsStatus('success');
              setMetricsResult(extractedMetrics);
            } else {
              setMetricsStatus('error');
              setMetricsError(`Partial extraction: ${validation.missingFields.slice(0, 3).join(', ')}...`);
              // Still keep the partial result
              setMetricsResult(extractedMetrics);
            }
          } else {
            setMetricsStatus('error');
            setMetricsError('Could not extract data from this file. Please ensure it is the Business Metrics XLSX report.');
          }
        } catch (err: any) {
          setMetricsStatus('error');
          setMetricsError('Failed to process file');
          console.error('Metrics extraction error:', err);
        }
      }
      
      // Process Bonus Qualifiers
      if (qualifiersFile) {
        setQualifiersStatus('processing');
        try {
          extractedQualifiers = await parseBonusQualifiers(qualifiersFile);
          
          if (extractedQualifiers) {
            const validation = validateBonusQualifiersExtraction(extractedQualifiers);
            if (validation.isValid) {
              setQualifiersStatus('success');
              setQualifiersResult(extractedQualifiers);
              if (validation.warnings.length > 0) {
                console.warn('Qualifiers extraction warnings:', validation.warnings);
              }
            } else {
              setQualifiersStatus('error');
              setQualifiersError('Could not extract tier data from image');
            }
          } else {
            setQualifiersStatus('error');
            setQualifiersError('Could not read the bonus grid. Please enter targets manually.');
          }
        } catch (err) {
          setQualifiersStatus('error');
          setQualifiersError('OCR processing failed');
          console.error('Qualifiers extraction error:', err);
        }
      }
      
      // Call completion handler with whatever we got
      if (extractedMetrics || extractedQualifiers) {
        onExtractionComplete(extractedMetrics, extractedQualifiers);
        toast.success('Data extracted! Review and adjust values as needed.');
      } else {
        toast.error('Could not extract data from the uploaded files');
      }
      
    } finally {
      setIsExtracting(false);
    }
  };

  const removeMetricsFile = () => {
    setMetricsFile(null);
    setMetricsStatus('empty');
    setMetricsError(null);
    setMetricsResult(null);
  };

  const removeQualifiersFile = () => {
    setQualifiersFile(null);
    setQualifiersStatus('empty');
    setQualifiersError(null);
    setQualifiersResult(null);
  };

  const getDropzoneStyles = (status: UploadStatus, isDragActive: boolean) => {
    const base = 'border-2 border-dashed rounded-lg p-4 transition-all cursor-pointer text-center';
    
    if (isDragActive) return `${base} border-primary bg-primary/10`;
    if (status === 'success') return `${base} border-green-500 bg-green-500/10`;
    if (status === 'error') return `${base} border-destructive bg-destructive/10`;
    if (status === 'selected' || status === 'processing') return `${base} border-primary/50 bg-primary/5`;
    return `${base} border-border hover:border-primary/50 hover:bg-muted/50`;
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="border-primary/20 bg-primary/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-primary/10 transition-colors py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Quick Setup - Upload Your Documents
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload your Business Metrics report and Bonus Qualifiers to automatically populate the calculator.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4">
              {/* Business Metrics Dropzone */}
              <div className="space-y-2">
                <div
                  {...metricsDropzone.getRootProps()}
                  className={getDropzoneStyles(metricsStatus, metricsDropzone.isDragActive)}
                >
                  <input {...metricsDropzone.getInputProps()} />
                  
                  {metricsStatus === 'empty' && (
                    <div className="space-y-2">
                      <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="font-medium text-sm">📊 Business Metrics Report</p>
                      <p className="text-xs text-muted-foreground">Drop XLSX file here</p>
                      <p className="text-xs text-muted-foreground/60">(.xlsx or .xls only)</p>
                    </div>
                  )}
                  
                  {metricsStatus === 'selected' && metricsFile && (
                    <div className="space-y-1">
                      <FileSpreadsheet className="h-6 w-6 mx-auto text-primary" />
                      <p className="text-sm font-medium truncate">{metricsFile.name}</p>
                      <p className="text-xs text-muted-foreground">Ready to extract</p>
                    </div>
                  )}
                  
                  {metricsStatus === 'processing' && (
                    <div className="space-y-2">
                      <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
                      <p className="text-sm">Extracting data...</p>
                    </div>
                  )}
                  
                  {metricsStatus === 'success' && (
                    <div className="space-y-1">
                      <Check className="h-6 w-6 mx-auto text-green-500" />
                      <p className="text-sm font-medium text-green-600">Data extracted</p>
                      <p className="text-xs text-muted-foreground">{metricsFile?.name}</p>
                    </div>
                  )}
                  
                  {metricsStatus === 'error' && (
                    <div className="space-y-1">
                      <AlertCircle className="h-6 w-6 mx-auto text-destructive" />
                      <p className="text-sm text-destructive">{metricsError}</p>
                    </div>
                  )}
                </div>
                
                {metricsFile && metricsStatus !== 'processing' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); removeMetricsFile(); }}
                    className="w-full text-xs"
                  >
                    <X className="h-3 w-3 mr-1" /> Remove file
                  </Button>
                )}
              </div>
              
              {/* Bonus Qualifiers Dropzone */}
              <div className="space-y-2">
                <div
                  {...qualifiersDropzone.getRootProps()}
                  className={getDropzoneStyles(qualifiersStatus, qualifiersDropzone.isDragActive)}
                >
                  <input {...qualifiersDropzone.getInputProps()} />
                  
                  {qualifiersStatus === 'empty' && (
                    <div className="space-y-2">
                      <Image className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="font-medium text-sm">Bonus Qualifiers Grid</p>
                      <p className="text-xs text-muted-foreground">Drop PNG, JPG, or PDF here</p>
                      <p className="text-xs text-muted-foreground/60">or click to browse</p>
                    </div>
                  )}
                  
                  {qualifiersStatus === 'selected' && qualifiersFile && (
                    <div className="space-y-1">
                      <Image className="h-6 w-6 mx-auto text-primary" />
                      <p className="text-sm font-medium truncate">{qualifiersFile.name}</p>
                      <p className="text-xs text-muted-foreground">Ready to extract</p>
                    </div>
                  )}
                  
                  {qualifiersStatus === 'processing' && (
                    <div className="space-y-2">
                      <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
                      <p className="text-sm">Running OCR...</p>
                    </div>
                  )}
                  
                  {qualifiersStatus === 'success' && (
                    <div className="space-y-1">
                      <Check className="h-6 w-6 mx-auto text-green-500" />
                      <p className="text-sm font-medium text-green-600">Tiers extracted</p>
                      <p className="text-xs text-muted-foreground">{qualifiersFile?.name}</p>
                    </div>
                  )}
                  
                  {qualifiersStatus === 'error' && (
                    <div className="space-y-1">
                      <AlertCircle className="h-6 w-6 mx-auto text-destructive" />
                      <p className="text-sm text-destructive">{qualifiersError}</p>
                    </div>
                  )}
                </div>
                
                {qualifiersFile && qualifiersStatus !== 'processing' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); removeQualifiersFile(); }}
                    className="w-full text-xs"
                  >
                    <X className="h-3 w-3 mr-1" /> Remove file
                  </Button>
                )}
              </div>
            </div>
            
            {/* Extract Button */}
            <Button
              onClick={handleExtract}
              disabled={(!metricsFile && !qualifiersFile) || isExtracting}
              className="w-full"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Extract & Populate Data
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground">
              💡 Download your Business Metrics report as XLSX from the "Business Metrics-Agency Printable View" in the Allstate portal.
            </p>
            
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground text-center">
                ℹ️ Or enter your data manually below
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
