import React from 'react';
import { LocationUploadCard } from './LocationUploadCard';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  locationCount: number;
  priorPeriod: LocationUpload[];
  currentPeriod: LocationUpload[];
  onLocationCountChange: (count: number) => void;
  onFileSelect: (period: 'prior' | 'current', locationId: number, file: File) => void;
  onClear: (period: 'prior' | 'current', locationId: number) => void;
}

export function MultiLocationUploadSection({
  locationCount,
  priorPeriod,
  currentPeriod,
  onLocationCountChange,
  onFileSelect,
  onClear
}: Props) {

  return (
    <div className="space-y-8">
      
      {/* Step 1: Location Count */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Step 1: Agency Configuration</h3>
        <p className="text-sm text-muted-foreground">
          How many agent numbers/locations do you need to upload?
        </p>
        
        <div className="flex items-center gap-4 max-w-xs">
          <Label htmlFor="location-count">Number of Locations:</Label>
          <Select
            value={locationCount.toString()}
            onValueChange={(val) => onLocationCountChange(parseInt(val))}
          >
            <SelectTrigger id="location-count" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 location</SelectItem>
              <SelectItem value="2">2 locations</SelectItem>
              <SelectItem value="3">3 locations</SelectItem>
              <SelectItem value="4">4 locations</SelectItem>
              <SelectItem value="5">5 locations</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Step 2: Prior Period Uploads */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Step 2: Prior Period Statements (Optional)</h3>
        <p className="text-sm text-muted-foreground">
          Upload your prior period compensation statement Excel files for comparison.
          {locationCount > 1 && ' Upload one file per location.'}
        </p>
        
        <div className={`grid gap-4 ${locationCount > 1 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'max-w-md'}`}>
          {priorPeriod.map((location, index) => (
            <LocationUploadCard
              key={location.id}
              location={location}
              locationIndex={index}
              totalLocations={locationCount}
              onFileSelect={(file) => onFileSelect('prior', location.id, file)}
              onClear={() => onClear('prior', location.id)}
            />
          ))}
        </div>
      </div>

      {/* Step 3: Current Period Uploads */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Step 3: Current Period Statements</h3>
        <p className="text-sm text-muted-foreground">
          Upload your current period compensation statement Excel files (.xlsx or .xls).
          {locationCount > 1 && ' Upload one file per location.'}
        </p>
        
        <div className={`grid gap-4 ${locationCount > 1 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'max-w-md'}`}>
          {currentPeriod.map((location, index) => (
            <LocationUploadCard
              key={location.id}
              location={location}
              locationIndex={index}
              totalLocations={locationCount}
              onFileSelect={(file) => onFileSelect('current', location.id, file)}
              onClear={() => onClear('current', location.id)}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
