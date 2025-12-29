import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LocationUpload {
  id: number;
  agentNumber: string;
  file: File | null;
  fileName: string;
  status: 'empty' | 'uploading' | 'parsed' | 'error';
  error?: string;
  transactionCount?: number;
}

interface Props {
  location: LocationUpload;
  locationIndex: number;
  totalLocations: number;
  onFileSelect: (file: File) => void;
  onClear: () => void;
}

export function LocationUploadCard({ 
  location, 
  locationIndex, 
  totalLocations,
  onFileSelect, 
  onClear 
}: Props) {
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    disabled: location.status === 'uploading'
  });

  const showLocationLabel = totalLocations > 1;

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        {showLocationLabel && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Location {locationIndex + 1}
            </Badge>
            {location.agentNumber && (
              <Badge variant="secondary" className="text-xs">
                Agent #{location.agentNumber}
              </Badge>
            )}
          </div>
        )}

        {/* Upload Area */}
        {location.status === 'empty' && (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-colors
              ${isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50 hover:bg-muted/30'
              }
            `}
          >
            <input {...getInputProps()} />
            <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {isDragActive ? 'Drop file here' : 'Drag & drop or click to select'}
            </p>
          </div>
        )}

        {/* Uploading State */}
        {location.status === 'uploading' && (
          <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{location.fileName}</p>
              <p className="text-xs text-muted-foreground">Parsing file...</p>
            </div>
          </div>
        )}

        {/* Parsed State */}
        {location.status === 'parsed' && (
          <div className="flex items-center justify-between gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{location.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {location.transactionCount?.toLocaleString()} transactions
                  {location.agentNumber && ` • Agent #${location.agentNumber}`}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onClear}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Error State */}
        {location.status === 'error' && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{location.fileName}</p>
                  <p className="text-xs text-destructive">{location.error}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onClear}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
