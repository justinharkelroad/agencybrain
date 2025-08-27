import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  Download,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supa } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import * as XLSX from 'xlsx';

interface FileProcessingProps {
  category: string;
  onMappingComplete?: (mapping: any) => void;
}

interface ParsedData {
  headers?: string[];
  sampleData?: any[];
  totalRows?: number;
  fileType?: string;
  fileName?: string;
  fileSize?: number;
  requiresClientProcessing?: boolean;
  extractedText?: string;
  requiresOCR?: boolean;
}

interface FileInfo {
  name: string;
  type: string;
  size: number;
  category: string;
}

const ColumnMappingWizard: React.FC<FileProcessingProps> = ({ 
  category, 
  onMappingComplete 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'upload' | 'mapping' | 'review' | 'complete'>('upload');
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Standard fields by category
  const standardFields = {
    sales: [
      { value: 'premium', label: 'Premium Amount' },
      { value: 'policies', label: 'Policy Count' },
      { value: 'commission', label: 'Commission' },
      { value: 'quote_count', label: 'Quotes Generated' },
      { value: 'conversion_rate', label: 'Conversion Rate' },
      { value: 'new_policies', label: 'New Policies' },
      { value: 'renewed_policies', label: 'Renewed Policies' },
      { value: 'cancelled_policies', label: 'Cancelled Policies' }
    ],
    marketing: [
      { value: 'total_spend', label: 'Total Marketing Spend' },
      { value: 'leads_generated', label: 'Leads Generated' },
      { value: 'cost_per_lead', label: 'Cost Per Lead' },
      { value: 'conversion_rate', label: 'Lead Conversion Rate' },
      { value: 'website_visits', label: 'Website Visits' },
      { value: 'social_media_engagement', label: 'Social Media Engagement' },
      { value: 'email_opens', label: 'Email Opens' }
    ],
    operations: [
      { value: 'staff_count', label: 'Staff Count' },
      { value: 'training_hours', label: 'Training Hours' },
      { value: 'customer_service_calls', label: 'Customer Service Calls' },
      { value: 'response_time', label: 'Average Response Time' },
      { value: 'processing_time', label: 'Processing Time' },
      { value: 'error_rate', label: 'Error Rate' },
      { value: 'efficiency_score', label: 'Efficiency Score' }
    ],
    retention: [
      { value: 'retention_rate', label: 'Customer Retention Rate' },
      { value: 'churn_rate', label: 'Churn Rate' },
      { value: 'customer_satisfaction', label: 'Customer Satisfaction Score' },
      { value: 'complaints', label: 'Customer Complaints' },
      { value: 'renewals', label: 'Policy Renewals' },
      { value: 'referrals', label: 'Customer Referrals' },
      { value: 'loyalty_score', label: 'Customer Loyalty Score' }
    ],
    cash_flow: [
      { value: 'revenue', label: 'Total Revenue' },
      { value: 'expenses', label: 'Total Expenses' },
      { value: 'net_profit', label: 'Net Profit' },
      { value: 'operating_costs', label: 'Operating Costs' },
      { value: 'commission_paid', label: 'Commission Paid' },
      { value: 'accounts_receivable', label: 'Accounts Receivable' },
      { value: 'accounts_payable', label: 'Accounts Payable' }
    ],
    qualitative: [
      { value: 'comments', label: 'Comments' },
      { value: 'feedback', label: 'Customer Feedback' },
      { value: 'notes', label: 'Notes' },
      { value: 'observations', label: 'Observations' },
      { value: 'improvements', label: 'Suggested Improvements' },
      { value: 'challenges', label: 'Challenges Faced' },
      { value: 'opportunities', label: 'Opportunities Identified' }
    ]
  };

  const categoryFields = standardFields[category as keyof typeof standardFields] || [];

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setIsProcessing(true);

    try {
      // Handle Excel files on client side
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length > 0) {
          const headers = jsonData[0].map((col: any) => String(col || ''));
          const sampleData = jsonData.slice(1, 6).map(row => {
            const rowData: any = {};
            headers.forEach((header, index) => {
              rowData[header] = row[index] || '';
            });
            return rowData;
          });

          setFileInfo({
            name: file.name,
            type: file.name.split('.').pop() || '',
            size: file.size,
            category
          });
          setParsedData({
            headers,
            sampleData,
            totalRows: jsonData.length - 1
          });
          setDetectedColumns(headers);
          setStep('mapping');
        }
      } else {
        // Use edge function for CSV and PDF processing
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);

        const response = await supabase.functions.invoke('process-file', {
          body: formData
        });

        if (response.error) throw response.error;

        const { fileInfo: info, parsedData: data, detectedColumns: columns, suggestedMappings } = response.data;
        
        setFileInfo(info);
        setParsedData(data);
        setDetectedColumns(columns);
        setColumnMappings(suggestedMappings || {});
        setStep('mapping');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: "Processing Failed",
        description: "Failed to process the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [category, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  const handleMappingChange = (originalColumn: string, mappedField: string) => {
    setColumnMappings(prev => ({
      ...prev,
      [originalColumn]: mappedField
    }));
  };

  const saveMapping = async () => {
    if (!user || !fileInfo) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('column_mappings')
        .insert({
          user_id: user.id,
          file_type: fileInfo.type,
          category: category,
          original_columns: detectedColumns,
          mapped_columns: columnMappings,
          mapping_rules: {}
        });

      if (error) throw error;

      toast({
        title: "Mapping Saved",
        description: "Column mapping has been saved successfully",
      });

      setStep('complete');
      onMappingComplete?.(columnMappings);

    } catch (error) {
      console.error('Error saving mapping:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save column mapping",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMappingStatus = () => {
    const mappedCount = Object.values(columnMappings).filter(val => val && val !== 'ignore').length;
    const totalColumns = detectedColumns.length;
    return `${mappedCount}/${totalColumns} columns mapped`;
  };

  return (
    <div className="space-y-6">
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload File for Processing
            </CardTitle>
            <CardDescription>
              Upload a CSV, Excel, or PDF file to set up column mapping for {category} data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
              }`}
            >
              <input {...getInputProps()} />
              {isProcessing ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                  <p className="text-sm text-muted-foreground">Processing file...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <FileText className="w-8 h-8 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">
                    {isDragActive ? 'Drop the file here...' : 'Drag & drop a file here, or click to select'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported: CSV, Excel (.xlsx, .xls), PDF
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && fileInfo && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="w-5 h-5" />
                Column Mapping
              </CardTitle>
              <CardDescription>
                Map the detected columns to standard fields for {category} analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{fileInfo.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(fileInfo.size)} • {getMappingStatus()}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {fileInfo.type}
                </Badge>
              </div>

              <Separator />

              {parsedData?.requiresOCR && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This PDF contains limited text. Consider using OCR services for better data extraction.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <h4 className="font-medium">Column Mappings</h4>
                {detectedColumns.map((column, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{column}</p>
                      <p className="text-sm text-muted-foreground">Original column</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <Select
                        value={columnMappings[column] || ''}
                        onValueChange={(value) => handleMappingChange(column, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ignore">Ignore Column</SelectItem>
                          {categoryFields.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">Custom Field</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>

              {parsedData?.sampleData && parsedData.sampleData.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Data Preview</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {detectedColumns.map((column, index) => (
                            <TableHead key={index} className="text-xs">
                              {column}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.sampleData.slice(0, 3).map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {detectedColumns.map((column, colIndex) => (
                              <TableCell key={colIndex} className="text-xs">
                                {String(row[column] || '').substring(0, 20)}
                                {String(row[column] || '').length > 20 && '...'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Showing 3 of {parsedData.totalRows} rows
                  </p>
                </div>
              )}

              {parsedData?.extractedText && (
                <div className="space-y-3">
                  <h4 className="font-medium">Extracted Text (PDF)</h4>
                  <div className="border rounded-lg p-4">
                    <p className="text-sm font-mono">{parsedData.extractedText}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={() => setStep('upload')} variant="outline">
                  Back
                </Button>
                <Button 
                  onClick={saveMapping} 
                  disabled={isSaving || Object.keys(columnMappings).length === 0}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  {isSaving ? 'Saving...' : 'Save Mapping'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'complete' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Mapping Complete
            </CardTitle>
            <CardDescription>
              Column mapping has been saved and can be reused for similar files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Your column mapping for {category} files has been saved successfully. 
                  Future uploads of similar files will use this mapping automatically.
                </AlertDescription>
              </Alert>
              
              <Button onClick={() => {
                setStep('upload');
                setFileInfo(null);
                setParsedData(null);
                setDetectedColumns([]);
                setColumnMappings({});
              }}>
                Process Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ColumnMappingWizard;