import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export interface SoldData {
  policies_sold: number;
  items_sold: number;
  premium_sold_cents: number;
  file_name: string;
  matched_name: string;
  rows_matched: number;
}

interface SoldDetailsUploadSectionProps {
  teamMemberName: string;
  onDataChange: (data: SoldData | null) => void;
}

const formatPremium = (cents: number): string => {
  const dollars = cents / 100;
  if (dollars >= 1000000) {
    return `$${(dollars / 1000000).toFixed(1)}M`;
  }
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}K`;
  }
  return `$${dollars.toFixed(0)}`;
};

const cleanName = (rawName: string): string => {
  // Strip number prefixes like "775-" or "108-"
  return rawName.replace(/^\d+-/, '').trim().toLowerCase();
};

const fuzzyMatchName = (fileName: string, targetName: string): boolean => {
  const cleanFileName = cleanName(fileName);
  const cleanTarget = targetName.toLowerCase().trim();
  
  if (!cleanFileName || !cleanTarget) return false;
  
  // Direct contains check
  if (cleanFileName.includes(cleanTarget) || cleanTarget.includes(cleanFileName)) {
    return true;
  }
  
  // Split into parts and check overlap
  const fileParts = cleanFileName.split(/[\s-]+/).filter(p => p.length > 1);
  const targetParts = cleanTarget.split(/[\s-]+/).filter(p => p.length > 1);
  
  // Check if first and last name match
  const matchingParts = fileParts.filter(fp => 
    targetParts.some(tp => fp.includes(tp) || tp.includes(fp))
  );
  
  return matchingParts.length >= 2;
};

const findHeaderRow = (rows: any[][], searchTerms: string[]): number => {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const rowStr = rows[i]?.map(c => String(c || '')).join(' ').toLowerCase() || '';
    if (searchTerms.some(term => rowStr.includes(term.toLowerCase()))) {
      return i;
    }
  }
  return -1;
};

const findColumnIndex = (headers: string[], searchTerms: string[]): number => {
  return headers.findIndex(h => 
    searchTerms.some(term => h.includes(term.toLowerCase()))
  );
};

export function SoldDetailsUploadSection({
  teamMemberName,
  onDataChange,
}: SoldDetailsUploadSectionProps) {
  const [soldData, setSoldData] = useState<SoldData | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = async (file: File): Promise<any[][]> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;

    setProcessing(true);
    try {
      const rows = await parseFile(file);

      // Find header row - look for "Sub-Producer Name", "Written Premium", etc.
      const headerIndex = findHeaderRow(rows, ['sub-producer name', 'sub producer', 'written premium', 'customer name']);
      if (headerIndex === -1) {
        toast.error('Could not find header row in file. Looking for columns like "Sub-Producer Name" or "Written Premium".');
        setProcessing(false);
        return;
      }

      const headers = rows[headerIndex].map((h: any) => String(h || '').toLowerCase().trim());
      const dataRows = rows.slice(headerIndex + 1);

      // Find column indices
      const subProducerIdx = findColumnIndex(headers, ['sub-producer name', 'sub producer name', 'producer name', 'agent name']);
      const premiumIdx = findColumnIndex(headers, ['written premium', 'premium']);
      const itemIdx = findColumnIndex(headers, ['item count', 'items', 'count']);
      const productIdx = findColumnIndex(headers, ['product description', 'product', 'line of business']);

      if (subProducerIdx === -1) {
        toast.error('Could not find Sub-Producer Name column');
        setProcessing(false);
        return;
      }

      // Collect unique names for potential warning
      const uniqueNames = new Set<string>();
      
      // Filter and sum - NO date filtering for sold details
      let policies = 0;
      let items = 0;
      let premiumCents = 0;
      let matchedName = '';

      dataRows.forEach((row: any[]) => {
        if (!row || row.length === 0) return;
        
        const rawName = String(row[subProducerIdx] || '');
        if (rawName) {
          uniqueNames.add(rawName);
        }

        // Fuzzy match to selected team member
        if (fuzzyMatchName(rawName, teamMemberName)) {
          matchedName = rawName;
          policies += 1;
          items += Number(row[itemIdx]) || 1;
          const premium = parseFloat(String(row[premiumIdx] || '0').replace(/[$,]/g, ''));
          premiumCents += Math.round((isNaN(premium) ? 0 : premium) * 100);
        }
      });

      if (policies === 0) {
        const namesList = Array.from(uniqueNames).slice(0, 10).join(', ');
        toast.error(`No records found for "${teamMemberName}". Found names: ${namesList}${uniqueNames.size > 10 ? '...' : ''}`);
        setProcessing(false);
        return;
      }

      const data: SoldData = {
        policies_sold: policies,
        items_sold: items,
        premium_sold_cents: premiumCents,
        file_name: file.name,
        matched_name: matchedName,
        rows_matched: policies,
      };

      setSoldData(data);
      onDataChange(data);
      toast.success(`Parsed ${policies} sold records for ${matchedName}`);
    } catch (err) {
      console.error('Error parsing sold details file:', err);
      toast.error('Failed to parse file');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClear = () => {
    setSoldData(null);
    onDataChange(null);
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-bold uppercase tracking-wide text-foreground">Sold Details</span>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
            >
              <Upload className="h-4 w-4 mr-2" />
              {processing ? 'Processing...' : 'UPLOAD'}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.xlsx,.xls"
              onChange={(e) => handleUpload(e.target.files?.[0])}
              className="hidden"
            />
          </div>
          {soldData && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {soldData && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{soldData.policies_sold}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">#POL</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{soldData.items_sold}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">#ITEM</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{formatPremium(soldData.premium_sold_cents)}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">$PREM</div>
            </div>
          </div>
        )}

        {!soldData && (
          <p className="text-sm text-muted-foreground">
            Upload a "New Business Details" report to see sold policies, items, and premium.
          </p>
        )}
      </div>
    </Card>
  );
}
