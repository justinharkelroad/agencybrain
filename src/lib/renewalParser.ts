import * as XLSX from 'xlsx';
import type { ParsedRenewalRecord } from '@/types/renewal';

const COLUMN_MAP: Record<string, keyof ParsedRenewalRecord> = {
  'Policy Number': 'policyNumber', 'Renewal Effective Date': 'renewalEffectiveDate',
  'First Name': 'firstName', 'Last Name': 'lastName', 'Email': 'email',
  'Phone': 'phone', 'Alt Phone': 'phoneAlt', 'Alternate Phone': 'phoneAlt',
  'Product': 'productName', 'Product Name': 'productName', 'Agent Number': 'agentNumber',
  'Agent #': 'agentNumber', 'Renewal Status': 'renewalStatus', 'Account Type': 'accountType',
  'Acct Type': 'accountType', 'Premium Old': 'premiumOld', 'Old Premium': 'premiumOld',
  'Prior Premium': 'premiumOld', 'Premium New': 'premiumNew', 'New Premium': 'premiumNew',
  'Renewal Premium': 'premiumNew', 'Premium Change': 'premiumChangeDollars',
  'Premium Diff': 'premiumChangeDollars', 'Change %': 'premiumChangePercent',
  'Premium Change %': 'premiumChangePercent', '% Change': 'premiumChangePercent',
  'Amount Due': 'amountDue', 'Balance Due': 'amountDue', 'Easy Pay': 'easyPay',
  'EasyPay': 'easyPay', 'Multi-line': 'multiLineIndicator', 'Multi Line': 'multiLineIndicator',
  'Multiline': 'multiLineIndicator', 'Bundled': 'multiLineIndicator', '# Items': 'itemCount',
  'No of Items': 'itemCount', 'Years Prior Insurance': 'yearsPriorInsurance',
  'Years w/ Insurance': 'yearsPriorInsurance', 'Household Key': 'householdKey', 'HH Key': 'householdKey',
};

function parseDate(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2,'0')}-${String(parsed.d).padStart(2,'0')}`;
  }
  if (typeof value === 'string') {
    const parts = value.split('/');
    if (parts.length === 3) {
      const [m, d, y] = parts;
      return `${y.length === 2 ? '20'+y : y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  }
  return null;
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value.replace(/[$,%\s]/g, ''));
    return isNaN(num) ? null : num;
  }
  return null;
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const l = value.toLowerCase().trim();
    return l === 'yes' || l === 'y' || l === 'true' || l === '1' || l === 'x';
  }
  return value === 1;
}

export function parseRenewalExcel(workbook: XLSX.WorkBook): ParsedRenewalRecord[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });
  if (!rawData.length) throw new Error('No data found');

  const headers = Object.keys(rawData[0]);
  const colIndex: Record<string, string> = {};
  for (const h of headers) { if (COLUMN_MAP[h.trim()]) colIndex[h.trim()] = COLUMN_MAP[h.trim()]; }
  if (!Object.values(colIndex).includes('policyNumber')) throw new Error('Policy Number column not found');

  const records: ParsedRenewalRecord[] = [];
  for (const row of rawData) {
    const rec: Partial<ParsedRenewalRecord> = {};
    for (const [h, f] of Object.entries(colIndex)) {
      const v = row[h];
      if (['policyNumber','firstName','lastName','email','phone','phoneAlt','productName','agentNumber','renewalStatus','accountType','householdKey'].includes(f))
        (rec as any)[f] = v ? String(v).trim() : null;
      else if (f === 'renewalEffectiveDate') rec.renewalEffectiveDate = parseDate(v) || '';
      else if (['premiumOld','premiumNew','premiumChangeDollars','premiumChangePercent','amountDue'].includes(f))
        (rec as any)[f] = parseNumber(v);
      else if (['itemCount','yearsPriorInsurance'].includes(f)) {
        const n = parseNumber(v); (rec as any)[f] = n !== null ? Math.round(n) : null;
      }
      else if (['easyPay','multiLineIndicator'].includes(f)) (rec as any)[f] = parseBoolean(v);
    }
    if (rec.policyNumber && rec.renewalEffectiveDate) {
      if (rec.premiumOld != null && rec.premiumNew != null) {
        if (rec.premiumChangeDollars == null) rec.premiumChangeDollars = rec.premiumNew - rec.premiumOld;
        if (rec.premiumChangePercent == null && rec.premiumOld !== 0)
          rec.premiumChangePercent = ((rec.premiumNew - rec.premiumOld) / rec.premiumOld) * 100;
      }
      // Set defaults for boolean fields if not set
      if (rec.easyPay === undefined) rec.easyPay = false;
      if (rec.multiLineIndicator === undefined) rec.multiLineIndicator = false;
      records.push(rec as ParsedRenewalRecord);
    }
  }
  if (!records.length) throw new Error('No valid records found');
  return records;
}

export function getRenewalDateRange(records: ParsedRenewalRecord[]) {
  const dates = records.map(r => r.renewalEffectiveDate).filter(Boolean).sort();
  return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null;
}
