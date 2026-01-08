import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileSpreadsheet, AlertCircle, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { parseLeadFile, applyLeadColumnMapping } from '@/lib/lead-csv-parser';
import { useLeadBackgroundUpload } from '@/hooks/useLeadBackgroundUpload';
import { LqsLeadSource } from '@/hooks/useLqsData';
import type { LeadColumnMapping, ParsedLeadFileResult } from '@/types/lqs';
import { cn } from '@/lib/utils';

interface LeadUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  leadSources: LqsLeadSource[];
  onUploadComplete?: () => void;
}

type Step = 'source' | 'upload' | 'mapping';

// Target fields - phones is handled separately with multi-select
const SINGLE_TARGET_FIELDS: { key: keyof Omit<LeadColumnMapping, 'phones'>; label: string; required: boolean }[] = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'zip_code', label: 'ZIP Code', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'products_interested', label: 'Products Interested', required: false },
  { key: 'lead_date', label: 'Lead Date', required: false },
];

export function LeadUploadModal({
  open,
  onOpenChange,
  agencyId,
  leadSources,
  onUploadComplete,
}: LeadUploadModalProps) {
  // Step state
  const [currentStep, setCurrentStep] = useState<Step>('source');
  
  // Step 1: Lead Source
  const [selectedLeadSourceId, setSelectedLeadSourceId] = useState<string>('');
  
  // Step 2: File
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParsedLeadFileResult | null>(null);
  
  // Step 3: Column Mapping
  const [columnMapping, setColumnMapping] = useState<LeadColumnMapping>({
    first_name: null,
    last_name: null,
    zip_code: null,
    phones: null,
    email: null,
    products_interested: null,
    lead_date: null,
  });
  
  // Starting state for button
  const [isStarting, setIsStarting] = useState(false);
  
  const { startBackgroundUpload } = useLeadBackgroundUpload();

  // Group lead sources by bucket
  const groupedSources = leadSources.reduce((acc, source) => {
    const bucketName = source.bucket?.name || 'Unassigned';
    if (!acc[bucketName]) acc[bucketName] = [];
    acc[bucketName].push(source);
    return acc;
  }, {} as Record<string, LqsLeadSource[]>);

  // Detect phone columns from headers
  const phoneColumnCandidates = parseResult?.headers.filter(h => {
    const lower = h.toLowerCase();
    return lower.includes('phone') || lower.includes('tel') || lower.includes('mobile') || lower.includes('cell');
  }) || [];

  const handleFileSelect = useCallback(async (file: File) => {
    const isValidType = file.name.endsWith('.csv') || 
      file.name.endsWith('.xlsx') || 
      file.type === 'text/csv' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    
    if (!isValidType) {
      return;
    }
    
    setSelectedFile(file);
    
    // Parse file
    const arrayBuffer = await file.arrayBuffer();
    const result = parseLeadFile(arrayBuffer, file.name);
    setParseResult(result);
    
    if (result.success) {
      setColumnMapping(result.suggestedMapping);
      setCurrentStep('mapping');
    }
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFileSelect(acceptedFiles[0]);
    }
  }, [handleFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleMappingChange = (field: keyof Omit<LeadColumnMapping, 'phones'>, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value === '__ignore__' ? null : value,
    }));
  };

  const handlePhoneColumnToggle = (columnName: string, checked: boolean) => {
    setColumnMapping(prev => {
      const currentPhones = prev.phones || [];
      if (checked) {
        return { ...prev, phones: [...currentPhones, columnName] };
      } else {
        return { ...prev, phones: currentPhones.filter(c => c !== columnName) };
      }
    });
  };

  const requiredFieldsMapped = SINGLE_TARGET_FIELDS
    .filter(f => f.required)
    .every(f => columnMapping[f.key] !== null);

  // Get preview of phone values
  const getPhonePreview = (): string => {
    if (!parseResult || !columnMapping.phones || columnMapping.phones.length === 0) return '';
    const phones: string[] = [];
    for (const colName of columnMapping.phones) {
      const sampleValue = parseResult.sampleRows[0]?.[colName];
      if (sampleValue) phones.push(sampleValue);
    }
    return phones.join(', ');
  };

  const handleStartUpload = () => {
    if (!parseResult || !selectedLeadSourceId) return;
    
    setIsStarting(true);
    
    const { records } = applyLeadColumnMapping(
      parseResult.allRows,
      parseResult.headers,
      columnMapping
    );
    
    const selectedSource = leadSources.find(s => s.id === selectedLeadSourceId);
    
    // Start background upload - fire and forget
    startBackgroundUpload(
      records,
      { agencyId, leadSourceId: selectedLeadSourceId },
      selectedSource?.name || 'Unknown Source'
    );
    
    // Close modal immediately
    handleClose();
    
    // Trigger callback
    if (onUploadComplete) {
      onUploadComplete();
    }
  };

  const handleClose = () => {
    // Reset all state
    setCurrentStep('source');
    setSelectedLeadSourceId('');
    setSelectedFile(null);
    setParseResult(null);
    setColumnMapping({
      first_name: null,
      last_name: null,
      zip_code: null,
      phones: null,
      email: null,
      products_interested: null,
      lead_date: null,
    });
    setIsStarting(false);
    onOpenChange(false);
  };

  const selectedSource = leadSources.find(s => s.id === selectedLeadSourceId);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        {/* Step 1: Select Lead Source */}
        {currentStep === 'source' && (
          <>
            <DialogHeader>
              <DialogTitle>Upload Leads - Step 1 of 3</DialogTitle>
              <DialogDescription>
                Select the lead source for this upload. All leads will be assigned to this source.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Lead Source *</Label>
                <Select value={selectedLeadSourceId} onValueChange={setSelectedLeadSourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a lead source..." />
                  </SelectTrigger>
                  <SelectContent side="bottom" position="popper" className="max-h-[300px]">
                    {Object.entries(groupedSources).map(([bucketName, sources]) => (
                      <div key={bucketName}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {bucketName}
                        </div>
                        {sources.map(source => (
                          <SelectItem key={source.id} value={source.id}>
                            <div className="flex items-center gap-2">
                              <span>{source.name}</span>
                              {source.is_self_generated && (
                                <span className="text-xs text-muted-foreground">(Self-gen)</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button 
                  onClick={() => setCurrentStep('upload')} 
                  disabled={!selectedLeadSourceId}
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Upload File */}
        {currentStep === 'upload' && (
          <>
            <DialogHeader>
              <DialogTitle>Upload Leads - Step 2 of 3</DialogTitle>
              <DialogDescription>
                Upload a CSV or Excel file containing your leads.
                <br />
                <span className="text-xs">Selected source: <strong>{selectedSource?.name}</strong></span>
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isDragActive
                    ? 'Drop the file here...'
                    : 'Drag and drop your CSV or Excel file here'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              </div>

              {selectedFile && parseResult && !parseResult.success && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Parse Error</p>
                      <ul className="text-xs text-destructive/80 mt-1 list-disc list-inside">
                        {parseResult.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep('source')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Column Mapping */}
        {currentStep === 'mapping' && parseResult && (
          <>
            <DialogHeader>
              <DialogTitle>Upload Leads - Step 3 of 3</DialogTitle>
              <DialogDescription>
                Map your file columns to lead fields. Required fields are marked with *.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* File info */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground flex-1 truncate">
                  {selectedFile?.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {parseResult.totalRows} rows
                </span>
              </div>

              {/* Single-select mapping table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 font-medium">Target Field</th>
                      <th className="text-left p-2 font-medium">File Column</th>
                      <th className="text-left p-2 font-medium">Sample Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SINGLE_TARGET_FIELDS.map(field => {
                      const mappedColumn = columnMapping[field.key];
                      const sampleValues = mappedColumn 
                        ? parseResult.sampleRows.map(r => r[mappedColumn]).filter(Boolean).slice(0, 2)
                        : [];
                      
                      return (
                        <tr key={field.key} className="border-t">
                          <td className="p-2">
                            <span className="flex items-center gap-1">
                              {field.label}
                              {field.required && <span className="text-destructive">*</span>}
                            </span>
                          </td>
                          <td className="p-2">
                            <Select 
                              value={mappedColumn || '__ignore__'} 
                              onValueChange={(v) => handleMappingChange(field.key, v)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__ignore__">
                                  <span className="text-muted-foreground">-- Ignore --</span>
                                </SelectItem>
                                {parseResult.headers.map(header => (
                                  <SelectItem key={header} value={header}>
                                    {header}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1 flex-wrap">
                              {sampleValues.map((v, i) => (
                                <Badge key={i} variant="secondary" className="text-xs font-normal">
                                  {String(v).substring(0, 20)}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Phone columns - multi-select with checkboxes */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Phone Columns</Label>
                  <span className="text-xs text-muted-foreground">Select all that apply</span>
                </div>
                
                {phoneColumnCandidates.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {phoneColumnCandidates.map(col => (
                        <div key={col} className="flex items-center space-x-2">
                          <Checkbox
                            id={`phone-col-${col}`}
                            checked={columnMapping.phones?.includes(col) || false}
                            onCheckedChange={(checked) => handlePhoneColumnToggle(col, checked as boolean)}
                          />
                          <Label htmlFor={`phone-col-${col}`} className="text-sm font-normal cursor-pointer">
                            {col}
                            {parseResult.sampleRows[0]?.[col] && (
                              <span className="text-muted-foreground ml-2">
                                ({parseResult.sampleRows[0][col]})
                              </span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                    
                    {/* Phone preview */}
                    {columnMapping.phones && columnMapping.phones.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          Preview: <span className="font-medium text-foreground">{getPhonePreview()}</span>
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      No phone columns detected. Select any column to use as phone:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {parseResult.headers.slice(0, 8).map(col => (
                        <div key={col} className="flex items-center space-x-2">
                          <Checkbox
                            id={`phone-col-${col}`}
                            checked={columnMapping.phones?.includes(col) || false}
                            onCheckedChange={(checked) => handlePhoneColumnToggle(col, checked as boolean)}
                          />
                          <Label htmlFor={`phone-col-${col}`} className="text-xs font-normal cursor-pointer truncate">
                            {col}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!requiredFieldsMapped && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                  <p className="text-sm text-yellow-600">
                    Please map all required fields before continuing.
                  </p>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep('upload')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>Cancel</Button>
                  <Button 
                    onClick={handleStartUpload} 
                    disabled={!requiredFieldsMapped || isStarting}
                  >
                    {isStarting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        Upload Leads
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}