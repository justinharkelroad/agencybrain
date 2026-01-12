import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { LeadSourceRoiRow } from './useLqsRoiAnalytics';

const PAGE_SIZE = 1000;
const MAX_FETCH = 20000;

// Helper to check if a date string is within a range
function isDateInRange(dateStr: string | null, range: { start: Date; end: Date } | null): boolean {
  if (!range) return true;
  if (!dateStr) return false;
  
  const date = new Date(dateStr);
  return date >= range.start && date <= range.end;
}

// Escape CSV value
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Format cents to currency string
function formatCentsToCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '$0';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Format ROI
function formatRoi(value: number | null): string {
  if (value === null) return '∞';
  return `${value.toFixed(2)}x`;
}

// Download file helper
function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface HouseholdDetailRow {
  id: string;
  status: string | null;
  lead_source_id: string | null;
  created_at: string;
  lead_received_date: string | null;
  insured_last_name: string | null;
  insured_first_name: string | null;
  insured_zip: string | null;
  quotes: Array<{ quote_date: string | null; premium_cents: number | null }> | null;
  sales: Array<{ sale_date: string | null; premium_cents: number | null; team_member_id: string | null }> | null;
}

export function useLqsRoiExport(
  agencyId: string | null,
  dateRange: { start: Date; end: Date } | null
) {
  // Export Summary CSV (Lead Source ROI table)
  const exportSummary = useCallback(async (data: LeadSourceRoiRow[]) => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      const headers = [
        'Lead Source',
        'Spend',
        'Open Leads',
        'Quoted HH',
        'Sold HH',
        'Premium',
        'Commission Earned',
        'ROI',
        'Cost/Sale'
      ];

      const rows = data.map(row => [
        escapeCSV(row.leadSourceName),
        escapeCSV(formatCentsToCurrency(row.spendCents)),
        escapeCSV(row.totalLeads),
        escapeCSV(row.totalQuotes),
        escapeCSV(row.totalSales),
        escapeCSV(formatCentsToCurrency(row.premiumCents)),
        escapeCSV(formatCentsToCurrency(row.commissionEarned)),
        escapeCSV(formatRoi(row.roi)),
        escapeCSV(row.costPerSale !== null ? formatCentsToCurrency(row.costPerSale) : '-')
      ]);

      // Calculate totals
      const totals = data.reduce((acc, row) => ({
        spend: acc.spend + row.spendCents,
        leads: acc.leads + row.totalLeads,
        quotes: acc.quotes + row.totalQuotes,
        sales: acc.sales + row.totalSales,
        premium: acc.premium + row.premiumCents,
        commission: acc.commission + row.commissionEarned
      }), { spend: 0, leads: 0, quotes: 0, sales: 0, premium: 0, commission: 0 });

      const overallRoi = totals.spend > 0 ? totals.commission / totals.spend : null;
      const avgCostPerSale = totals.sales > 0 ? totals.spend / totals.sales : null;

      // Add totals row
      rows.push([
        escapeCSV('TOTALS'),
        escapeCSV(formatCentsToCurrency(totals.spend)),
        escapeCSV(totals.leads),
        escapeCSV(totals.quotes),
        escapeCSV(totals.sales),
        escapeCSV(formatCentsToCurrency(totals.premium)),
        escapeCSV(formatCentsToCurrency(totals.commission)),
        escapeCSV(formatRoi(overallRoi)),
        escapeCSV(avgCostPerSale !== null ? formatCentsToCurrency(avgCostPerSale) : '-')
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const dateStr = dateRange 
        ? `${format(dateRange.start, 'yyyy-MM-dd')}_to_${format(dateRange.end, 'yyyy-MM-dd')}`
        : 'all-time';
      
      downloadCSV(csv, `lqs-roi-summary-${dateStr}.csv`);
      toast.success('Summary exported successfully');
    } catch (error) {
      console.error('Export summary error:', error);
      toast.error('Failed to export summary');
    }
  }, [dateRange]);

  // Export Details CSV (household-level data)
  const exportDetails = useCallback(async () => {
    if (!agencyId) {
      toast.error('No agency selected');
      return;
    }

    try {
      toast.info('Preparing export...', { duration: 2000 });

      // Fetch all households with full details
      const allRows: HouseholdDetailRow[] = [];
      
      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        const { data: page, error } = await supabase
          .from('lqs_households')
          .select(`
            id,
            status,
            lead_source_id,
            created_at,
            lead_received_date,
            insured_last_name,
            insured_first_name,
            insured_zip,
            quotes:lqs_quotes(quote_date, premium_cents),
            sales:lqs_sales(sale_date, premium_cents, team_member_id)
          `)
          .eq('agency_id', agencyId)
          .range(from, from + PAGE_SIZE - 1);
        
        if (error) throw error;
        if (!page || page.length === 0) break;
        
        allRows.push(...(page as HouseholdDetailRow[]));
        if (page.length < PAGE_SIZE) break;
      }

      // Fetch lead sources for name mapping
      const { data: leadSources, error: lsError } = await supabase
        .from('lead_sources')
        .select('id, name')
        .eq('agency_id', agencyId);
      
      if (lsError) throw lsError;
      const leadSourceMap = new Map<string, string>(leadSources?.map(ls => [ls.id, ls.name]) || []);

      // Fetch team members for producer names
      const { data: teamMembers, error: tmError } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('agency_id', agencyId);
      
      if (tmError) throw tmError;
      const teamMemberMap = new Map<string, string>(teamMembers?.map(tm => [tm.id, tm.name]) || []);

      // Filter households based on status-specific date fields
      const filteredHouseholds = allRows.filter(h => {
        if (!dateRange) return true;
        
        if (h.status === 'lead') {
          const leadDate = h.lead_received_date || h.created_at;
          return isDateInRange(leadDate, dateRange);
        } else if (h.status === 'quoted') {
          if (!h.quotes || h.quotes.length === 0) return false;
          return h.quotes.some(q => isDateInRange(q.quote_date, dateRange));
        } else if (h.status === 'sold') {
          if (!h.sales || h.sales.length === 0) return false;
          return h.sales.some(s => isDateInRange(s.sale_date, dateRange));
        }
        
        return isDateInRange(h.created_at, dateRange);
      });

      if (filteredHouseholds.length === 0) {
        toast.error('No data to export for selected date range');
        return;
      }

      const headers = [
        'Last Name',
        'First Name',
        'Status',
        'Lead Source',
        'ZIP',
        'Lead Date',
        'Quote Date',
        'Sale Date',
        'Premium',
        'Producer'
      ];

      const rows = filteredHouseholds.map(h => {
        // Get the first quote date (or latest if multiple)
        const quoteDate = h.quotes && h.quotes.length > 0
          ? h.quotes.sort((a, b) => new Date(b.quote_date || 0).getTime() - new Date(a.quote_date || 0).getTime())[0].quote_date
          : null;
        
        // Get the first sale (or latest if multiple)
        const sale = h.sales && h.sales.length > 0
          ? h.sales.sort((a, b) => new Date(b.sale_date || 0).getTime() - new Date(a.sale_date || 0).getTime())[0]
          : null;
        
        const saleDate = sale?.sale_date || null;
        const premium = sale?.premium_cents || null;
        const producerId = sale?.team_member_id || null;
        const producerName = producerId ? teamMemberMap.get(producerId) : null;

        return [
          escapeCSV(h.insured_last_name),
          escapeCSV(h.insured_first_name),
          escapeCSV(h.status),
          escapeCSV(h.lead_source_id ? leadSourceMap.get(h.lead_source_id) || 'Unknown' : 'Unattributed'),
          escapeCSV(h.insured_zip),
          escapeCSV(h.lead_received_date ? format(new Date(h.lead_received_date), 'MM/dd/yyyy') : ''),
          escapeCSV(quoteDate ? format(new Date(quoteDate), 'MM/dd/yyyy') : ''),
          escapeCSV(saleDate ? format(new Date(saleDate), 'MM/dd/yyyy') : ''),
          escapeCSV(premium ? formatCentsToCurrency(premium) : ''),
          escapeCSV(producerName || '')
        ];
      });

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const dateStr = dateRange 
        ? `${format(dateRange.start, 'yyyy-MM-dd')}_to_${format(dateRange.end, 'yyyy-MM-dd')}`
        : 'all-time';
      
      downloadCSV(csv, `lqs-roi-details-${dateStr}.csv`);
      toast.success(`Exported ${filteredHouseholds.length} households`);
    } catch (error) {
      console.error('Export details error:', error);
      toast.error('Failed to export details');
    }
  }, [agencyId, dateRange]);

  return {
    exportSummary,
    exportDetails
  };
}
