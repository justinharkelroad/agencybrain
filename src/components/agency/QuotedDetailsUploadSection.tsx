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
  // Strip number prefixes like "775-" or "108-" or "011-"
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
  
  // Split into parts and check if all target parts appear in file name
  const fileParts = cleanFileName.split(/[\s-]+/).filter(p => p.length > 1);
  const targetParts = cleanTarget.split(/[\s-]+/).filter(p => p.length > 1);
  
  // Check if all parts of target name appear in file name
  const allTargetPartsMatch = targetParts.every(tp => 
    fileParts.some(fp => fp.includes(tp) || tp.includes(fp))
  );
  
  // Check if all parts of file name appear in target name
  const allFilePartsMatch = fileParts.every(fp => 
    targetParts.some(tp => fp.includes(tp) || tp.includes(fp))
  );
  
  return allTargetPartsMatch || allFilePartsMatch;
};

const parseExcelDate = (value: any): Date | null => {
  if (!value) return null;
  
  // Handle Excel serial date numbers
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 86400000);
  }
  
  // If it's already a Date
  if (value instanceof Date) {
    return value;
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

  const findTargetSheet = (workbook: XLSX.WorkBook): string => {
    console.log('Sheet names:', workbook.SheetNames);
    
    // Look for sheet with "Detail" or "Conversion" in the name
    for (const sheetName of workbook.SheetNames) {
      const lowerName = sheetName.toLowerCase();
      if (lowerName.includes('detail') || lowerName.includes('conversion')) {
        console.log('Found target sheet by name:', sheetName);
        return sheetName;
      }
    }
    
    // If no "detail" sheet found, find the sheet with the most rows
    if (workbook.SheetNames.length > 1) {
      let maxRows = 0;
      let targetSheet = workbook.SheetNames[0];
      
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        if (data.length > maxRows) {
          maxRows = data.length;
          targetSheet = sheetName;
        }
      }
      console.log('Using sheet with most rows:', targetSheet, 'rows:', maxRows);
      return targetSheet;
    }
    
    return workbook.SheetNames[0];
  };

  const findHeaderRow = (rows: any[][]): { index: number; headers: string[] } => {
    // Look for row containing "Sub Producer" or similar columns
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i];
      if (!row) continue;
      
      const rowStr = row.map(cell => String(cell || '').toLowerCase()).join(' ');
      if (rowStr.includes('sub producer') || 
          rowStr.includes('production date') || 
          rowStr.includes('quoted premium') ||
          rowStr.includes('written by')) {
        const headers = row.map((cell: any) => String(cell || '').toLowerCase().trim());
        console.log('Found header row at index:', i, 'headers:', headers);
        return { index: i, headers };
      }
    }
    
    // If no header row found, assume first non-empty row is headers
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      if (rows[i] && rows[i].length > 3) {
        const headers = rows[i].map((cell: any) => String(cell || '').toLowerCase().trim());
        console.log('Using first non-empty row as headers at index:', i);
        return { index: i, headers };
      }
    }
    
    return { index: -1, headers: [] };
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;

    setProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      // Find the correct sheet
      const targetSheetName = findTargetSheet(workbook);
      console.log('Using sheet:', targetSheetName);
      
      const sheet = workbook.Sheets[targetSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      // Find header row
      const { index: headerIndex, headers } = findHeaderRow(rows);
      
      if (headerIndex === -1 || headers.length === 0) {
        toast.error('Could not find header row in file. Looking for columns like "Sub Producer" or "Production Date".');
        setProcessing(false);
        return;
      }

      const dataRows = rows.slice(headerIndex + 1);

      // Find column indices
      const subProducerIdx = findColumnIndex(headers, ['sub producer', 'subproducer', 'written by', 'producer']);
      const dateIdx = findColumnIndex(headers, ['production date', 'quote date']);
      const premiumIdx = findColumnIndex(headers, ['quoted premium', 'premium']);
      const itemIdx = findColumnIndex(headers, ['item count', 'quoted item', 'items', 'count']);

      console.log('Column indices - SubProducer:', subProducerIdx, 'Date:', dateIdx, 'Premium:', premiumIdx, 'Items:', itemIdx);

      if (subProducerIdx === -1) {
        toast.error('Could not find Sub Producer/Written By column in file');
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
        if (rawName && rawName.trim()) {
          uniqueNames.add(rawName);
        }

        // Fuzzy match to selected team member
        if (fuzzyMatchName(rawName, teamMemberName)) {
          matchedName = rawName;
          
          // Check date range if date column exists
          if (dateIdx >= 0) {
            const rowDate = parseExcelDate(row[dateIdx]);
            if (rowDate) {
              // Set dates to start/end of day for comparison
              const rowDateStart = new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate());
              const startDateStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
              const endDateEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
              
              if (rowDateStart < startDateStart || rowDateStart > endDateEnd) {
                return; // Skip if outside date range
              }
            }
          }
          
          policies += 1;
          items += Number(row[itemIdx]) || 1;
          const premium = parseFloat(String(row[premiumIdx] || '0').replace(/[$,]/g, ''));
          premiumCents += Math.round((isNaN(premium) ? 0 : premium) * 100);
        }
      });

      console.log('Matched records:', policies);
      console.log('Unique names found:', Array.from(uniqueNames));

      if (policies === 0) {
        const namesList = Array.from(uniqueNames).slice(0, 15).join('\n• ');
        toast.error(`No records found for "${teamMemberName}". Found names:\n• ${namesList}${uniqueNames.size > 15 ? '\n...' : ''}`, {
          duration: 8000,
        });
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
        date_range_applied: dateIdx >= 0,
      };

      setQuotedData(data);
      onDataChange(data);
      toast.success(`Parsed ${policies} quoted records for ${cleanName(matchedName) || teamMemberName}`);
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
          <div className="flex flex-col gap-1">
            <span className="font-bold uppercase tracking-wide text-foreground">Quoted Details</span>
            <span className="text-sm text-muted-foreground">Upload Quoted Detail and Conversion Rate Report</span>
          </div>
          <div className="flex items-center gap-2">
            {quotedData && (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button 
              size="sm"
              className="bg-red-700 hover:bg-red-800 text-white"
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
