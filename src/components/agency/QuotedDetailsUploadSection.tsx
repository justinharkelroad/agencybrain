import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export interface QuotedData {
  policies_quoted: number;
  items_quoted: number;
  premium_quoted_cents: number;
  file_name: string;
  matched_name: string;
  rows_matched: number;
  date_range_applied: boolean;
}

interface QuotedDetailsUploadSectionProps {
  teamMemberName: string;
  startDate: Date;
  endDate: Date;
  onDataChange: (data: QuotedData | null) => void;
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

const parseDate = (value: any): Date | null => {
  if (!value) return null;
  
  // Handle Excel serial date numbers
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 86400000);
  }
  
  const str = String(value).trim();
  
  // Try MM/DD/YYYY format
  const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdyMatch) {
    const month = parseInt(mdyMatch[1]) - 1;
    const day = parseInt(mdyMatch[2]);
    let year = parseInt(mdyMatch[3]);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }
  
  // Try YYYY-MM-DD format
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }
  
  // Fallback to Date.parse
  const parsed = Date.parse(str);
  return isNaN(parsed) ? null : new Date(parsed);
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

export function QuotedDetailsUploadSection({
  teamMemberName,
  startDate,
  endDate,
  onDataChange,
}: QuotedDetailsUploadSectionProps) {
  const [quotedData, setQuotedData] = useState<QuotedData | null>(null);
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

      // Find header row - look for "Production Date", "Quote Date", or "Written By"
      const headerIndex = findHeaderRow(rows, ['production date', 'quote date', 'written by', 'sub producer']);
      if (headerIndex === -1) {
        toast.error('Could not find header row in file. Looking for columns like "Production Date" or "Sub Producer".');
        setProcessing(false);
        return;
      }

      const headers = rows[headerIndex].map((h: any) => String(h || '').toLowerCase().trim());
      const dataRows = rows.slice(headerIndex + 1);

      // Find column indices
      const subProducerIdx = findColumnIndex(headers, ['sub producer', 'written by', 'producer']);
      const dateIdx = findColumnIndex(headers, ['production date', 'quote date', 'date']);
      const premiumIdx = findColumnIndex(headers, ['premium', 'quoted premium']);
      const itemIdx = findColumnIndex(headers, ['item count', 'items', 'count']);
      const productIdx = findColumnIndex(headers, ['product', 'line of business', 'lob']);

      if (subProducerIdx === -1) {
        toast.error('Could not find Sub Producer/Written By column');
        setProcessing(false);
        return;
      }

      // Collect unique names for potential warning
      const uniqueNames = new Set<string>();
      
      // Filter and sum
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
          
          // Check date range
          const rowDate = dateIdx >= 0 ? parseDate(row[dateIdx]) : null;
          const inDateRange = !rowDate || (rowDate >= startDate && rowDate <= endDate);
          
          if (inDateRange) {
            policies += 1;
            items += Number(row[itemIdx]) || 1;
            const premium = parseFloat(String(row[premiumIdx] || '0').replace(/[$,]/g, ''));
            premiumCents += Math.round((isNaN(premium) ? 0 : premium) * 100);
          }
        }
      });

      if (policies === 0) {
        const namesList = Array.from(uniqueNames).slice(0, 10).join(', ');
        toast.error(`No records found for "${teamMemberName}". Found names: ${namesList}${uniqueNames.size > 10 ? '...' : ''}`);
        setProcessing(false);
        return;
      }

      const data: QuotedData = {
        policies_quoted: policies,
        items_quoted: items,
        premium_quoted_cents: premiumCents,
        file_name: file.name,
        matched_name: matchedName,
        rows_matched: policies,
        date_range_applied: true,
      };

      setQuotedData(data);
      onDataChange(data);
      toast.success(`Parsed ${policies} quoted records for ${matchedName}`);
    } catch (err) {
      console.error('Error parsing quoted details file:', err);
      toast.error('Failed to parse file');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClear = () => {
    setQuotedData(null);
    onDataChange(null);
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-bold uppercase tracking-wide text-foreground">Quoted Details</span>
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
          {quotedData && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {quotedData && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{quotedData.policies_quoted}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">#POL</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{quotedData.items_quoted}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">#ITEM</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{formatPremium(quotedData.premium_quoted_cents)}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">$PREM</div>
            </div>
          </div>
        )}

        {!quotedData && (
          <p className="text-sm text-muted-foreground">
            Upload a "Quotes Detail and Conversion Rate Report" to see quoted policies, items, and premium.
          </p>
        )}
      </div>
    </Card>
  );
}
