import type { ParsedCall, CallGap, AgentSummary, ParseResult, OfficeHours } from './types';

// ─── CSV Parser (handles quoted fields, embedded quotes) ─────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const row: string[] = [];
    while (i < len) {
      if (text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = '';
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') {
              // Escaped quote
              field += '"';
              i += 2;
            } else {
              // End of quoted field
              i++; // skip closing quote
              break;
            }
          } else {
            field += text[i];
            i++;
          }
        }
        row.push(field);
        // Skip comma or end of line
        if (i < len && text[i] === ',') {
          i++;
        } else if (i < len && (text[i] === '\r' || text[i] === '\n')) {
          if (text[i] === '\r' && i + 1 < len && text[i + 1] === '\n') i += 2;
          else i++;
          break;
        }
      } else if (text[i] === '\r' || text[i] === '\n') {
        // Empty field at end of line
        row.push('');
        if (text[i] === '\r' && i + 1 < len && text[i + 1] === '\n') i += 2;
        else i++;
        break;
      } else {
        // Unquoted field
        let field = '';
        while (i < len && text[i] !== ',' && text[i] !== '\r' && text[i] !== '\n') {
          field += text[i];
          i++;
        }
        row.push(field);
        if (i < len && text[i] === ',') {
          i++;
        } else {
          if (i < len && text[i] === '\r' && i + 1 < len && text[i + 1] === '\n') i += 2;
          else if (i < len) i++;
          break;
        }
      }
    }
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
      rows.push(row);
    }
  }
  return rows;
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function officeHoursToDate(timeStr: string, dateStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

// ─── Gap computation (exported for re-use on office-hours change) ───────────

export function computeGapsForAgent(
  calls: ParsedCall[],
  officeHours: OfficeHours,
  selectedDate: string
): CallGap[] {
  if (calls.length === 0) return [];

  const sorted = [...calls].sort((a, b) => a.callStart.getTime() - b.callStart.getTime());
  const gaps: CallGap[] = [];

  const dayStart = officeHoursToDate(officeHours.start, selectedDate);
  const dayEnd = officeHoursToDate(officeHours.end, selectedDate);

  // Pre-first-call gap
  const firstCall = sorted[0];
  const preGapSeconds = Math.round((firstCall.callStart.getTime() - dayStart.getTime()) / 1000);
  if (preGapSeconds > 0) {
    gaps.push({
      agentName: firstCall.agentName,
      gapStart: dayStart,
      gapEnd: firstCall.callStart,
      durationSeconds: preGapSeconds,
      callBefore: null,
      callAfter: firstCall,
    });
  }

  // Gaps between consecutive calls
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const currentEnd = new Date(current.callStart.getTime() + current.durationSeconds * 1000);
    const gapSeconds = Math.round((next.callStart.getTime() - currentEnd.getTime()) / 1000);
    if (gapSeconds > 0) {
      gaps.push({
        agentName: current.agentName,
        gapStart: currentEnd,
        gapEnd: next.callStart,
        durationSeconds: gapSeconds,
        callBefore: current,
        callAfter: next,
      });
    }
  }

  // Post-last-call gap
  const lastCall = sorted[sorted.length - 1];
  const lastCallEnd = new Date(lastCall.callStart.getTime() + lastCall.durationSeconds * 1000);
  const postGapSeconds = Math.round((dayEnd.getTime() - lastCallEnd.getTime()) / 1000);
  if (postGapSeconds > 0) {
    gaps.push({
      agentName: lastCall.agentName,
      gapStart: lastCallEnd,
      gapEnd: dayEnd,
      durationSeconds: postGapSeconds,
      callBefore: lastCall,
      callAfter: null,
    });
  }

  return gaps;
}

// ─── RingCentral (.xlsx) parser ─────────────────────────────────────────────

async function parseRingCentral(file: File, selectedDate?: string): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Get known agents from Filters sheet
  const filtersSheet = workbook.Sheets['Filters'];
  if (!filtersSheet) throw new Error('No "Filters" sheet found in workbook');

  const knownAgents = new Set<string>();
  const filtersData = XLSX.utils.sheet_to_json<Record<string, unknown>>(filtersSheet, { header: 1 }) as unknown[][];
  for (let i = 1; i < filtersData.length; i++) {
    const row = filtersData[i];
    if (row && row[1] && typeof row[1] === 'string' && row[1].trim()) {
      knownAgents.add(row[1].trim());
    }
  }

  // Parse Calls sheet
  const callsSheet = workbook.Sheets['Calls'];
  if (!callsSheet) throw new Error('No "Calls" sheet found in workbook');

  const callsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(callsSheet);
  const allCalls: ParsedCall[] = [];
  const dateSet = new Set<string>();

  for (const row of callsRaw) {
    const direction = String(row['Call Direction'] || '').trim();
    const fromName = String(row['From Name'] || '').trim();
    const toName = String(row['To Name'] || '').trim();
    const fromNumber = String(row['From Number'] || '').trim();
    const toNumber = String(row['To Number'] || '').trim();
    const result = String(row['Result'] || '').trim();

    // Resolve agent
    let agentName: string;
    if (direction.toLowerCase() === 'outbound') {
      agentName = fromName;
    } else {
      agentName = toName;
    }

    // Only include known agents
    if (!knownAgents.has(agentName)) continue;

    // Parse call start time
    const startRaw = row['Call Start Time'];
    if (!startRaw) continue;
    const callStart = new Date(String(startRaw));
    if (isNaN(callStart.getTime())) continue;

    const dateStr = toDateString(callStart);
    dateSet.add(dateStr);

    // Parse call length (Excel time serial or Date object)
    let durationSeconds = 0;
    const lengthRaw = row['Call Length'];
    if (typeof lengthRaw === 'number') {
      durationSeconds = Math.round(lengthRaw * 86400);
    } else if (lengthRaw instanceof Date) {
      durationSeconds = lengthRaw.getHours() * 3600 + lengthRaw.getMinutes() * 60 + lengthRaw.getSeconds();
    } else if (typeof lengthRaw === 'string') {
      // "MM:SS" or "HH:MM:SS"
      const parts = lengthRaw.split(':').map(Number);
      if (parts.length === 2) {
        durationSeconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    }

    // Contact info
    const isOutbound = direction.toLowerCase() === 'outbound';
    allCalls.push({
      agentName,
      callStart,
      durationSeconds,
      direction: isOutbound ? 'outbound' : 'inbound',
      contactName: isOutbound ? toName : fromName,
      contactPhone: isOutbound ? toNumber : fromNumber,
      result,
    });
  }

  const availableDates = Array.from(dateSet).sort().reverse();
  const targetDate = selectedDate || availableDates[0];
  if (!targetDate) throw new Error('No calls found in file');

  return buildResult(allCalls, targetDate, availableDates, 'ringcentral');
}

// ─── Ricochet (.csv) parser ─────────────────────────────────────────────────

async function parseRicochet(file: File, selectedDate?: string): Promise<ParseResult> {
  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('CSV file is empty or has no data rows');

  const headers = rows[0].map(h => h.trim());
  const dateIdx = headers.indexOf('Date');
  const fullNameIdx = headers.indexOf('Full name');
  const userIdx = headers.indexOf('User');
  const fromIdx = headers.indexOf('From');
  const toIdx = headers.indexOf('To');
  const durationSecondsIdx = headers.indexOf('Call Duration In Seconds');
  const callTypeIdx = headers.indexOf('Call Type');

  if (dateIdx === -1 || userIdx === -1) {
    throw new Error('Unrecognized CSV format — missing required columns');
  }

  const allCalls: ParsedCall[] = [];
  const dateSet = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < headers.length) continue;

    const dateRaw = row[dateIdx]?.trim();
    if (!dateRaw) continue;

    const callStart = new Date(dateRaw);
    if (isNaN(callStart.getTime())) continue;

    const dateStr = toDateString(callStart);
    dateSet.add(dateStr);

    const agentName = row[userIdx]?.trim() || 'Unknown';
    const contactName = fullNameIdx >= 0 ? (row[fullNameIdx]?.trim() || '') : '';
    const durationSeconds = durationSecondsIdx >= 0 ? parseInt(row[durationSecondsIdx], 10) || 0 : 0;

    const callType = callTypeIdx >= 0 ? (row[callTypeIdx]?.trim().toLowerCase() || '') : '';
    const isInbound = callType.includes('inbound') || callType.includes('live-q') || callType.includes('ivr');
    const direction: 'inbound' | 'outbound' = isInbound ? 'inbound' : 'outbound';

    const contactPhone = direction === 'outbound'
      ? (toIdx >= 0 ? (row[toIdx]?.trim() || '') : '')
      : (fromIdx >= 0 ? (row[fromIdx]?.trim() || '') : '');

    allCalls.push({
      agentName,
      callStart,
      durationSeconds,
      direction,
      contactName,
      contactPhone,
      result: '',
    });
  }

  const availableDates = Array.from(dateSet).sort().reverse();
  const targetDate = selectedDate || availableDates[0];
  if (!targetDate) throw new Error('No calls found in file');

  return buildResult(allCalls, targetDate, availableDates, 'ricochet');
}

// ─── Shared result builder ──────────────────────────────────────────────────

function buildResult(
  allCalls: ParsedCall[],
  targetDate: string,
  availableDates: string[],
  sourceFormat: 'ringcentral' | 'ricochet'
): ParseResult {
  const dayCalls = allCalls.filter(c => toDateString(c.callStart) === targetDate);

  const agentMap = new Map<string, ParsedCall[]>();
  for (const call of dayCalls) {
    const existing = agentMap.get(call.agentName) || [];
    existing.push(call);
    agentMap.set(call.agentName, existing);
  }

  const defaultOfficeHours: OfficeHours = { start: '08:00', end: '18:00' };

  const agents: AgentSummary[] = Array.from(agentMap.entries()).map(([name, calls]) => {
    const sorted = calls.sort((a, b) => a.callStart.getTime() - b.callStart.getTime());
    const inboundCalls = sorted.filter(c => c.direction === 'inbound');
    const outboundCalls = sorted.filter(c => c.direction === 'outbound');

    return {
      agentName: name,
      totalCalls: sorted.length,
      inboundCalls: inboundCalls.length,
      outboundCalls: outboundCalls.length,
      totalTalkSeconds: sorted.reduce((sum, c) => sum + c.durationSeconds, 0),
      inboundTalkSeconds: inboundCalls.reduce((sum, c) => sum + c.durationSeconds, 0),
      outboundTalkSeconds: outboundCalls.reduce((sum, c) => sum + c.durationSeconds, 0),
      calls: sorted,
      gaps: computeGapsForAgent(sorted, defaultOfficeHours, targetDate),
    };
  });

  // Sort agents by name
  agents.sort((a, b) => a.agentName.localeCompare(b.agentName));

  return {
    agents,
    availableDates,
    sourceFormat,
    rawCallCount: allCalls.length,
  };
}

// ─── Reconstruct ParseResult from DB records ────────────────────────────────

export interface CallGapDbRecord {
  agent_name: string;
  call_start: string;   // ISO timestamp
  call_date: string;     // YYYY-MM-DD
  duration_seconds: number;
  direction: 'inbound' | 'outbound';
  contact_name: string;
  contact_phone: string;
  result: string;
}

export function buildParseResultFromRecords(
  records: CallGapDbRecord[],
  sourceFormat: 'ringcentral' | 'ricochet',
  selectedDate: string,
  officeHours: OfficeHours
): ParseResult {
  const dayCalls: ParsedCall[] = records
    .filter(r => r.call_date === selectedDate)
    .map(r => ({
      agentName: r.agent_name,
      callStart: new Date(r.call_start),
      durationSeconds: r.duration_seconds,
      direction: r.direction,
      contactName: r.contact_name,
      contactPhone: r.contact_phone,
      result: r.result,
    }));

  const agentMap = new Map<string, ParsedCall[]>();
  for (const call of dayCalls) {
    const existing = agentMap.get(call.agentName) || [];
    existing.push(call);
    agentMap.set(call.agentName, existing);
  }

  const agents: AgentSummary[] = Array.from(agentMap.entries()).map(([name, calls]) => {
    const sorted = calls.sort((a, b) => a.callStart.getTime() - b.callStart.getTime());
    const inboundCalls = sorted.filter(c => c.direction === 'inbound');
    const outboundCalls = sorted.filter(c => c.direction === 'outbound');

    return {
      agentName: name,
      totalCalls: sorted.length,
      inboundCalls: inboundCalls.length,
      outboundCalls: outboundCalls.length,
      totalTalkSeconds: sorted.reduce((sum, c) => sum + c.durationSeconds, 0),
      inboundTalkSeconds: inboundCalls.reduce((sum, c) => sum + c.durationSeconds, 0),
      outboundTalkSeconds: outboundCalls.reduce((sum, c) => sum + c.durationSeconds, 0),
      calls: sorted,
      gaps: computeGapsForAgent(sorted, officeHours, selectedDate),
    };
  });

  agents.sort((a, b) => a.agentName.localeCompare(b.agentName));

  // Compute available dates from all records
  const dateSet = new Set<string>();
  for (const r of records) {
    dateSet.add(r.call_date);
  }
  const availableDates = Array.from(dateSet).sort().reverse();

  return {
    agents,
    availableDates,
    sourceFormat,
    rawCallCount: records.length,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function parseCallFile(
  file: File,
  selectedDate?: string
): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'xlsx') {
    return parseRingCentral(file, selectedDate);
  } else if (ext === 'csv') {
    return parseRicochet(file, selectedDate);
  } else {
    throw new Error('Unrecognized file format. Expected .xlsx (RingCentral) or .csv (Ricochet).');
  }
}

export async function getAvailableDates(file: File): Promise<string[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const dateSet = new Set<string>();

  if (ext === 'xlsx') {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const callsSheet = workbook.Sheets['Calls'];
    if (!callsSheet) return [];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(callsSheet);
    for (const row of rows) {
      const startRaw = row['Call Start Time'];
      if (!startRaw) continue;
      const d = new Date(String(startRaw));
      if (!isNaN(d.getTime())) dateSet.add(toDateString(d));
    }
  } else if (ext === 'csv') {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    const dateIdx = headers.indexOf('Date');
    if (dateIdx === -1) return [];
    for (let i = 1; i < rows.length; i++) {
      const val = rows[i]?.[dateIdx]?.trim();
      if (!val) continue;
      const d = new Date(val);
      if (!isNaN(d.getTime())) dateSet.add(toDateString(d));
    }
  }

  return Array.from(dateSet).sort().reverse();
}
