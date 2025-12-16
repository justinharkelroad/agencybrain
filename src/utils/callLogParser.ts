import Papa from 'papaparse';

export interface ParsedCall {
  user: string;
  durationSeconds: number;
  dateTime: Date;
  direction: 'inbound' | 'outbound' | 'unknown';
  connected: boolean;
  rawData: Record<string, string>;
}

export interface ParsedCallLog {
  format: 'ringcentral' | 'ricochet' | 'generic';
  calls: ParsedCall[];
  users: string[];
  dateRange: { start: Date; end: Date };
  parseErrors: string[];
}

type CSVRow = Record<string, string>;

/**
 * Parse phone number from RingCentral "From Name" field
 * "Nate Carty (806) 866-0619" → "Nate Carty"
 * "Gunnar Direct - 8067916430 - CARNELL JEFF (806) 544-6415" → "Gunnar Direct"
 */
export function parseRingCentralName(fromName: string): string {
  if (!fromName) return 'Unknown';
  
  // Detect "Direct" line pattern: "FirstName Direct - 1234567890 - CALLER INFO..."
  // Normalize to just "FirstName Direct" to consolidate all calls to that direct line
  const directMatch = fromName.match(/^(\w+)\s+Direct\s*-/i);
  if (directMatch) {
    const firstName = directMatch[1].charAt(0).toUpperCase() + directMatch[1].slice(1).toLowerCase();
    return `${firstName} Direct`;
  }
  
  // Original logic: strip trailing phone number
  return fromName.replace(/\s*\(\d{3}\)\s*\d{3}-\d{4}.*$/, '').trim() || 'Unknown';
}

/**
 * Parse duration string to seconds
 * Handles: "1:30" (1min 30sec), "01:30:00" (1hr 30min), "90" (90 seconds), "1m 30s"
 */
function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;
  
  const trimmed = duration.trim();
  
  // Pure number (seconds)
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  
  // HH:MM:SS or MM:SS format
  const colonMatch = trimmed.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (colonMatch) {
    if (colonMatch[3] !== undefined) {
      // HH:MM:SS
      return parseInt(colonMatch[1], 10) * 3600 + parseInt(colonMatch[2], 10) * 60 + parseInt(colonMatch[3], 10);
    } else {
      // MM:SS
      return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
    }
  }
  
  // "Xm Ys" or "X min Y sec" format
  const minSecMatch = trimmed.match(/(\d+)\s*m(?:in)?(?:utes?)?\s*(\d+)?\s*s(?:ec)?(?:onds?)?/i);
  if (minSecMatch) {
    const mins = parseInt(minSecMatch[1], 10) || 0;
    const secs = parseInt(minSecMatch[2], 10) || 0;
    return mins * 60 + secs;
  }
  
  // Just seconds with "s" suffix
  const secMatch = trimmed.match(/^(\d+)\s*s(?:ec)?(?:onds?)?$/i);
  if (secMatch) {
    return parseInt(secMatch[1], 10);
  }
  
  // Just minutes with "m" suffix
  const minMatch = trimmed.match(/^(\d+)\s*m(?:in)?(?:utes?)?$/i);
  if (minMatch) {
    return parseInt(minMatch[1], 10) * 60;
  }
  
  return 0;
}

/**
 * Parse various date formats to Date object
 */
function parseDateTime(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const trimmed = dateStr.trim();
  
  // Try native parsing first
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  // Try MM/DD/YYYY HH:MM:SS format
  const usFormat = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (usFormat) {
    let hours = parseInt(usFormat[4], 10);
    const ampm = usFormat[7]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    
    return new Date(
      parseInt(usFormat[3], 10),
      parseInt(usFormat[1], 10) - 1,
      parseInt(usFormat[2], 10),
      hours,
      parseInt(usFormat[5], 10),
      parseInt(usFormat[6], 10) || 0
    );
  }
  
  return null;
}

/**
 * Detect CSV format based on headers
 */
function detectFormat(headers: string[]): 'ringcentral' | 'ricochet' | 'generic' {
  const headerLower = headers.map(h => h.toLowerCase());
  
  // RingCentral detection
  if (
    headerLower.some(h => h.includes('from name')) &&
    headerLower.some(h => h.includes('call length')) &&
    headerLower.some(h => h.includes('call start time'))
  ) {
    return 'ringcentral';
  }
  
  // Ricochet detection
  if (
    headerLower.some(h => h === 'user') &&
    headerLower.some(h => h.includes('call duration in seconds')) &&
    headerLower.some(h => h === 'date')
  ) {
    return 'ricochet';
  }
  
  return 'generic';
}

/**
 * Find column by partial match
 */
function findColumn(headers: string[], ...keywords: string[]): string | null {
  const headerLower = headers.map(h => h.toLowerCase());
  
  for (const keyword of keywords) {
    const idx = headerLower.findIndex(h => h.includes(keyword.toLowerCase()));
    if (idx !== -1) return headers[idx];
  }
  
  return null;
}

/**
 * Parse RingCentral format
 */
function parseRingCentral(rows: CSVRow[], headers: string[]): { calls: ParsedCall[]; errors: string[] } {
  const calls: ParsedCall[] = [];
  const errors: string[] = [];
  
  const fromNameCol = findColumn(headers, 'from name') || 'From Name';
  const durationCol = findColumn(headers, 'call length') || 'Call Length';
  const dateTimeCol = findColumn(headers, 'call start time') || 'Call Start Time';
  const directionCol = findColumn(headers, 'call direction') || 'Call Direction';
  const resultCol = findColumn(headers, 'result') || 'Result';
  
  rows.forEach((row, idx) => {
    try {
      const fromName = row[fromNameCol] || '';
      const user = parseRingCentralName(fromName);
      
      const durationStr = row[durationCol] || '0';
      const durationSeconds = parseDurationToSeconds(durationStr);
      
      const dateTimeStr = row[dateTimeCol] || '';
      const dateTime = parseDateTime(dateTimeStr);
      
      if (!dateTime) {
        errors.push(`Row ${idx + 2}: Invalid date "${dateTimeStr}"`);
        return;
      }
      
      const directionRaw = (row[directionCol] || '').toLowerCase();
      let direction: 'inbound' | 'outbound' | 'unknown' = 'unknown';
      if (directionRaw.includes('inbound')) direction = 'inbound';
      else if (directionRaw.includes('outbound')) direction = 'outbound';
      
      const resultRaw = (row[resultCol] || '').toLowerCase();
      const connected = resultRaw.includes('connected') || resultRaw.includes('answered');
      
      calls.push({
        user,
        durationSeconds,
        dateTime,
        direction,
        connected,
        rawData: row,
      });
    } catch (e) {
      errors.push(`Row ${idx + 2}: Parse error`);
    }
  });
  
  return { calls, errors };
}

/**
 * Parse Ricochet format
 */
function parseRicochet(rows: CSVRow[], headers: string[]): { calls: ParsedCall[]; errors: string[] } {
  const calls: ParsedCall[] = [];
  const errors: string[] = [];
  
  const userCol = findColumn(headers, 'user') || 'User';
  const durationCol = findColumn(headers, 'call duration in seconds') || 'Call Duration In Seconds';
  const dateCol = findColumn(headers, 'date') || 'Date';
  const callTypeCol = findColumn(headers, 'call type') || 'Call Type';
  const statusCol = findColumn(headers, 'call status') || 'Call Status';
  
  rows.forEach((row, idx) => {
    try {
      const user = row[userCol]?.trim() || 'Unknown';
      
      const durationStr = row[durationCol] || '0';
      const durationSeconds = parseInt(durationStr, 10) || 0;
      
      const dateStr = row[dateCol] || '';
      const dateTime = parseDateTime(dateStr);
      
      if (!dateTime) {
        errors.push(`Row ${idx + 2}: Invalid date "${dateStr}"`);
        return;
      }
      
      const callType = (row[callTypeCol] || '').toLowerCase();
      let direction: 'inbound' | 'outbound' | 'unknown' = 'unknown';
      if (callType.includes('inbound')) direction = 'inbound';
      else if (callType.includes('outbound') || callType.includes('manual')) direction = 'outbound';
      
      const status = (row[statusCol] || '').toLowerCase();
      const connected = status.includes('completed') || status.includes('answered');
      
      calls.push({
        user,
        durationSeconds,
        dateTime,
        direction,
        connected,
        rawData: row,
      });
    } catch (e) {
      errors.push(`Row ${idx + 2}: Parse error`);
    }
  });
  
  return { calls, errors };
}

/**
 * Parse generic format - attempt to find columns by keywords
 */
function parseGeneric(rows: CSVRow[], headers: string[]): { calls: ParsedCall[]; errors: string[] } {
  const calls: ParsedCall[] = [];
  const errors: string[] = [];
  
  // Find user column
  const userCol = findColumn(headers, 'user', 'agent', 'name', 'rep', 'employee', 'caller');
  if (!userCol) {
    errors.push('Unable to find user/agent column');
    return { calls, errors };
  }
  
  // Find duration column
  const durationCol = findColumn(headers, 'duration', 'seconds', 'length', 'talk time');
  if (!durationCol) {
    errors.push('Unable to find duration column');
    return { calls, errors };
  }
  
  // Find date column
  const dateCol = findColumn(headers, 'date', 'time', 'start', 'timestamp');
  if (!dateCol) {
    errors.push('Unable to find date column');
    return { calls, errors };
  }
  
  // Optional columns
  const directionCol = findColumn(headers, 'direction', 'type', 'call type');
  const statusCol = findColumn(headers, 'status', 'result', 'outcome');
  
  rows.forEach((row, idx) => {
    try {
      const user = row[userCol]?.trim() || 'Unknown';
      
      const durationStr = row[durationCol] || '0';
      const durationSeconds = parseDurationToSeconds(durationStr);
      
      const dateStr = row[dateCol] || '';
      const dateTime = parseDateTime(dateStr);
      
      if (!dateTime) {
        errors.push(`Row ${idx + 2}: Invalid date "${dateStr}"`);
        return;
      }
      
      let direction: 'inbound' | 'outbound' | 'unknown' = 'unknown';
      if (directionCol) {
        const dirVal = (row[directionCol] || '').toLowerCase();
        if (dirVal.includes('inbound') || dirVal.includes('in')) direction = 'inbound';
        else if (dirVal.includes('outbound') || dirVal.includes('out')) direction = 'outbound';
      }
      
      let connected = true; // Default to true for generic
      if (statusCol) {
        const statusVal = (row[statusCol] || '').toLowerCase();
        connected = statusVal.includes('connected') || statusVal.includes('answered') || statusVal.includes('completed');
      }
      
      calls.push({
        user,
        durationSeconds,
        dateTime,
        direction,
        connected,
        rawData: row,
      });
    } catch (e) {
      errors.push(`Row ${idx + 2}: Parse error`);
    }
  });
  
  return { calls, errors };
}

/**
 * Main parser function - auto-detects format and parses CSV
 */
export function parseCallLogCSV(csvText: string): ParsedCallLog {
  const result: ParsedCallLog = {
    format: 'generic',
    calls: [],
    users: [],
    dateRange: { start: new Date(), end: new Date() },
    parseErrors: [],
  };
  
  // Parse CSV
  const parsed = Papa.parse<CSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  
  if (parsed.errors.length > 0) {
    result.parseErrors = parsed.errors.map(e => `CSV Error: ${e.message}`);
  }
  
  const rows = parsed.data;
  const headers = parsed.meta.fields || [];
  
  if (rows.length === 0) {
    result.parseErrors.push('No data rows found in CSV');
    return result;
  }
  
  // Detect format
  result.format = detectFormat(headers);
  
  // Parse based on format
  let parseResult: { calls: ParsedCall[]; errors: string[] };
  
  switch (result.format) {
    case 'ringcentral':
      parseResult = parseRingCentral(rows, headers);
      break;
    case 'ricochet':
      parseResult = parseRicochet(rows, headers);
      break;
    default:
      parseResult = parseGeneric(rows, headers);
  }
  
  result.calls = parseResult.calls;
  result.parseErrors = [...result.parseErrors, ...parseResult.errors];
  
  // Extract unique users
  result.users = [...new Set(result.calls.map(c => c.user))].sort();
  
  // Calculate date range
  if (result.calls.length > 0) {
    const dates = result.calls.map(c => c.dateTime.getTime());
    result.dateRange = {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates)),
    };
  }
  
  return result;
}
