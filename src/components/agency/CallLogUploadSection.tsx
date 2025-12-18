import { useState, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Upload, Clock, PhoneOutgoing, X } from 'lucide-react';
import { toast } from 'sonner';
import { parseCallLogCSV, ParsedCall } from '@/utils/callLogParser';
import { formatTalkTime } from '@/utils/callEfficiencyCalculator';
import * as XLSX from 'xlsx';

interface CallLogUploadSectionProps {
  teamMemberName: string;
  startDate: Date;
  endDate: Date;
  onDataChange: (data: CallLogData | null) => void;
}

export interface CallLogData {
  total_outbound_calls: number;
  total_inbound_calls: number;
  calls_over_threshold: number;
  threshold_minutes: number;
  total_talk_time_seconds: number;
  raw_user_match: string;
  file_name: string;
}

const THRESHOLD_OPTIONS = [5, 10, 15, 20];

export function CallLogUploadSection({
  teamMemberName,
  startDate,
  endDate,
  onDataChange,
}: CallLogUploadSectionProps) {
  const [callLogData, setCallLogData] = useState<CallLogData | null>(null);
  const [thresholdMinutes, setThresholdMinutes] = useState(10);
  const [parsedCalls, setParsedCalls] = useState<ParsedCall[]>([]);
  const [matchedUser, setMatchedUser] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fuzzy match team member name to CSV user
  const fuzzyMatchUser = useCallback((users: string[], targetName: string): string | null => {
    const targetLower = targetName.toLowerCase().trim();
    const targetParts = targetLower.split(/\s+/);
    
    // Strip number prefixes like "775-" from names
    const cleanName = (name: string) => name.replace(/^\d+-/, '').trim();
    
    for (const user of users) {
      const cleanedUser = cleanName(user).toLowerCase();
      
      // Exact match
      if (cleanedUser === targetLower) return user;
      
      // Check if all target name parts are in the user name
      const allPartsMatch = targetParts.every(part => cleanedUser.includes(part));
      if (allPartsMatch) return user;
      
      // Check if user name contains first and last name
      const userParts = cleanedUser.split(/\s+/);
      const hasFirstName = targetParts[0] && userParts.some(p => p.includes(targetParts[0]));
      const hasLastName = targetParts.length > 1 && userParts.some(p => p.includes(targetParts[targetParts.length - 1]));
      if (hasFirstName && hasLastName) return user;
    }
    
    return null;
  }, []);

  // Calculate stats from calls
  const calculateStats = useCallback((calls: ParsedCall[], threshold: number, userName: string, file: string) => {
    // Filter by date range
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Filter calls by user and date range
    const filteredCalls = calls.filter(call => {
      const isUserMatch = call.user.toLowerCase().includes(userName.toLowerCase()) || 
                          userName.toLowerCase().includes(call.user.toLowerCase().replace(/^\d+-/, '').trim());
      const callDate = new Date(call.dateTime);
      const isInDateRange = callDate >= startOfDay && callDate <= endOfDay;
      return isUserMatch && isInDateRange;
    });

    const thresholdSeconds = threshold * 60;
    
    const data: CallLogData = {
      total_outbound_calls: filteredCalls.filter(c => c.direction === 'outbound').length,
      total_inbound_calls: filteredCalls.filter(c => c.direction === 'inbound').length,
      calls_over_threshold: filteredCalls.filter(c => c.durationSeconds >= thresholdSeconds).length,
      threshold_minutes: threshold,
      total_talk_time_seconds: filteredCalls.reduce((sum, c) => sum + c.durationSeconds, 0),
      raw_user_match: userName,
      file_name: file,
    };

    setCallLogData(data);
    onDataChange(data);
  }, [startDate, endDate, onDataChange]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let csvText: string;

      if (extension === 'xlsx' || extension === 'xls') {
        // Parse Excel file
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        csvText = XLSX.utils.sheet_to_csv(firstSheet);
      } else if (extension === 'csv') {
        csvText = await file.text();
      } else {
        toast.error('Please upload a CSV or Excel file');
        return;
      }

      const parsed = parseCallLogCSV(csvText);
      
      if (parsed.parseErrors.length > 0) {
        console.warn('Parse warnings:', parsed.parseErrors);
      }

      if (parsed.calls.length === 0) {
        toast.error('No valid call records found in file');
        return;
      }

      setParsedCalls(parsed.calls);
      setFileName(file.name);

      // Try to match team member
      const matched = fuzzyMatchUser(parsed.users, teamMemberName);
      
      if (matched) {
        setMatchedUser(matched);
        calculateStats(parsed.calls, thresholdMinutes, matched, file.name);
        toast.success(`Matched "${matched}" from call log`);
      } else {
        // If no match, use first user or show warning
        const fallbackUser = parsed.users[0] || teamMemberName;
        setMatchedUser(fallbackUser);
        calculateStats(parsed.calls, thresholdMinutes, fallbackUser, file.name);
        toast.warning(`Could not match "${teamMemberName}" - using "${fallbackUser}"`);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Failed to parse file');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle threshold change
  const handleThresholdChange = (value: string) => {
    const newThreshold = parseInt(value, 10);
    setThresholdMinutes(newThreshold);
    
    if (parsedCalls.length > 0 && matchedUser) {
      calculateStats(parsedCalls, newThreshold, matchedUser, fileName);
    }
  };

  // Clear uploaded data
  const handleClear = () => {
    setCallLogData(null);
    setParsedCalls([]);
    setMatchedUser('');
    setFileName('');
    onDataChange(null);
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Call Log</h3>
            {fileName && (
              <span className="text-sm text-muted-foreground">({fileName})</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {callLogData && (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              UPLOAD
            </Button>
          </div>
        </div>

        {/* Stats display */}
        {callLogData && (
          <div className="grid grid-cols-3 gap-4">
            {/* Total Calls */}
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                <PhoneOutgoing className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">Calls</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {callLogData.total_outbound_calls}
              </div>
              <div className="text-xs text-muted-foreground">
                outbound
              </div>
            </div>

            {/* Calls Over Threshold */}
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <Select value={thresholdMinutes.toString()} onValueChange={handleThresholdChange}>
                  <SelectTrigger className="h-auto p-0 border-0 bg-transparent text-xs font-medium uppercase w-auto gap-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THRESHOLD_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t.toString()}>
                        {t}M+
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {callLogData.calls_over_threshold}
              </div>
              <div className="text-xs text-muted-foreground">
                calls ≥{thresholdMinutes}min
              </div>
            </div>

            {/* Total Talk Time */}
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">Total TT</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {formatTalkTime(callLogData.total_talk_time_seconds)}
              </div>
              <div className="text-xs text-muted-foreground">
                talk time
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!callLogData && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">Upload a CSV or Excel call log to see metrics</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default CallLogUploadSection;
