import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Search,
  Download,
  History,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface ActivityRow {
  id: string;
  type: 'quote' | 'sale';
  date: string;
  staffName: string;
  customer: string;
  zip: string;
  productType: string;
  items: number;
  premiumCents: number;
  leadSource: string;
}

type SortKey = 'date' | 'staffName' | 'customer' | 'productType' | 'items' | 'premiumCents';

type TypeFilter = 'all' | 'quote' | 'sale';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  sortAsc,
  onClick,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentSortKey: SortKey;
  sortAsc: boolean;
  onClick: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = currentSortKey === sortKey;
  return (
    <TableHead
      className={cn('cursor-pointer hover:bg-muted/50 select-none', className)}
      onClick={() => onClick(sortKey)}
    >
      <div className="flex items-center gap-1 justify-end">
        {label}
        {isActive ? (
          sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </div>
    </TableHead>
  );
}

const PAGE_SIZE = 10;

interface ActivityHistoryTableProps {
  agencyId: string | null;
  dateRange: { start: Date; end: Date } | null;
}

export function ActivityHistoryTable({ agencyId, dateRange }: ActivityHistoryTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
    setPage(0);
  };

  // Fetch team members
  const teamMembersQuery = useQuery({
    queryKey: ['activity-team-members', agencyId],
    enabled: !!agencyId,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('agency_id', agencyId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch lead sources
  const leadSourcesQuery = useQuery({
    queryKey: ['activity-lead-sources', agencyId],
    enabled: !!agencyId,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_sources')
        .select('id, name')
        .eq('agency_id', agencyId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch quotes with household info
  const quotesQuery = useQuery({
    queryKey: ['activity-quotes', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async () => {
      let query = supabase
        .from('lqs_quotes')
        .select('id, quote_date, team_member_id, premium_cents, items_quoted, product_type, household_id, household:lqs_households!inner(first_name, last_name, zip_code, lead_source_id)')
        .eq('agency_id', agencyId!);

      if (dateRange) {
        const startStr = format(dateRange.start, 'yyyy-MM-dd');
        const endStr = format(dateRange.end, 'yyyy-MM-dd');
        query = query.gte('quote_date', startStr).lte('quote_date', endStr);
      }

      const { data, error } = await query.order('quote_date', { ascending: false }).limit(5000);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch sales with household info
  const salesQuery = useQuery({
    queryKey: ['activity-sales', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async () => {
      let query = supabase
        .from('lqs_sales')
        .select('id, sale_date, team_member_id, premium_cents, items_sold, policies_sold, product_type, household_id, household:lqs_households!inner(first_name, last_name, zip_code, lead_source_id)')
        .eq('agency_id', agencyId!);

      if (dateRange) {
        const startStr = format(dateRange.start, 'yyyy-MM-dd');
        const endStr = format(dateRange.end, 'yyyy-MM-dd');
        query = query.gte('sale_date', startStr).lte('sale_date', endStr);
      }

      const { data, error } = await query.order('sale_date', { ascending: false }).limit(5000);
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = teamMembersQuery.isLoading || leadSourcesQuery.isLoading || quotesQuery.isLoading || salesQuery.isLoading;

  // Build lookup maps
  const teamMemberMap = useMemo(() => {
    const m = new Map<string, string>();
    (teamMembersQuery.data || []).forEach(tm => m.set(tm.id, tm.name));
    return m;
  }, [teamMembersQuery.data]);

  const leadSourceMap = useMemo(() => {
    const m = new Map<string, string>();
    (leadSourcesQuery.data || []).forEach(ls => m.set(ls.id, ls.name));
    return m;
  }, [leadSourcesQuery.data]);

  // Build activity rows
  const allRows = useMemo<ActivityRow[]>(() => {
    const rows: ActivityRow[] = [];

    (quotesQuery.data || []).forEach(q => {
      const hh = q.household as unknown as { first_name: string; last_name: string; zip_code: string | null; lead_source_id: string | null } | null;
      rows.push({
        id: `q-${q.id}`,
        type: 'quote',
        date: q.quote_date,
        staffName: teamMemberMap.get(q.team_member_id || '') || 'Unassigned',
        customer: hh ? `${hh.first_name} ${hh.last_name}`.trim() : 'Unknown',
        zip: hh?.zip_code || '-',
        productType: q.product_type || '-',
        items: q.items_quoted || 0,
        premiumCents: q.premium_cents || 0,
        leadSource: hh?.lead_source_id ? (leadSourceMap.get(hh.lead_source_id) || 'Unknown') : 'None',
      });
    });

    (salesQuery.data || []).forEach(s => {
      const hh = s.household as unknown as { first_name: string; last_name: string; zip_code: string | null; lead_source_id: string | null } | null;
      rows.push({
        id: `s-${s.id}`,
        type: 'sale',
        date: s.sale_date,
        staffName: teamMemberMap.get(s.team_member_id || '') || 'Unassigned',
        customer: hh ? `${hh.first_name} ${hh.last_name}`.trim() : 'Unknown',
        zip: hh?.zip_code || '-',
        productType: s.product_type || '-',
        items: s.items_sold || 0,
        premiumCents: s.premium_cents || 0,
        leadSource: hh?.lead_source_id ? (leadSourceMap.get(hh.lead_source_id) || 'Unknown') : 'None',
      });
    });

    return rows;
  }, [quotesQuery.data, salesQuery.data, teamMemberMap, leadSourceMap]);

  // Extract unique staff and product types for filters
  const staffNames = useMemo(() => {
    const s = new Set(allRows.map(r => r.staffName));
    return Array.from(s).sort();
  }, [allRows]);

  const productTypes = useMemo(() => {
    const s = new Set(allRows.filter(r => r.productType !== '-').map(r => r.productType));
    return Array.from(s).sort();
  }, [allRows]);

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let rows = allRows;

    if (typeFilter !== 'all') {
      rows = rows.filter(r => r.type === typeFilter);
    }
    if (staffFilter !== 'all') {
      rows = rows.filter(r => r.staffName === staffFilter);
    }
    if (productFilter !== 'all') {
      rows = rows.filter(r => r.productType === productFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        r.customer.toLowerCase().includes(q) ||
        r.zip.toLowerCase().includes(q) ||
        r.leadSource.toLowerCase().includes(q)
      );
    }

    return [...rows].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortKey) {
        case 'date':
          aVal = a.date;
          bVal = b.date;
          break;
        case 'staffName':
          aVal = a.staffName.toLowerCase();
          bVal = b.staffName.toLowerCase();
          break;
        case 'customer':
          aVal = a.customer.toLowerCase();
          bVal = b.customer.toLowerCase();
          break;
        case 'productType':
          aVal = a.productType.toLowerCase();
          bVal = b.productType.toLowerCase();
          break;
        case 'items':
          aVal = a.items;
          bVal = b.items;
          break;
        case 'premiumCents':
          aVal = a.premiumCents;
          bVal = b.premiumCents;
          break;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [allRows, typeFilter, staffFilter, productFilter, search, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const pagedRows = filteredAndSorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // CSV export
  const handleExport = () => {
    const headers = ['Type', 'Date', 'Staff', 'Customer', 'Zip', 'Product', 'Items', 'Premium', 'Lead Source'];
    const csvRows = [headers.join(',')];
    filteredAndSorted.forEach(r => {
      csvRows.push([
        r.type,
        r.date,
        `"${r.staffName}"`,
        `"${r.customer}"`,
        r.zip,
        `"${r.productType}"`,
        r.items,
        (r.premiumCents / 100).toFixed(2),
        `"${r.leadSource}"`,
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity History
          </span>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredAndSorted.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customer, zip, source..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={v => { setTypeFilter(v as TypeFilter); setPage(0); }}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="quote">Quotes Only</SelectItem>
              <SelectItem value="sale">Sales Only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={staffFilter} onValueChange={v => { setStaffFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="All Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffNames.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={productFilter} onValueChange={v => { setProductFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="All Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {productTypes.map(pt => (
                <SelectItem key={pt} value={pt}>{pt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <SortableHeader label="Date" sortKey="date" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} className="text-left" />
                <SortableHeader label="Staff" sortKey="staffName" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} className="text-left" />
                <SortableHeader label="Customer" sortKey="customer" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} className="text-left" />
                <TableHead>Zip</TableHead>
                <SortableHeader label="Product" sortKey="productType" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} className="text-left" />
                <SortableHeader label="Items" sortKey="items" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} />
                <SortableHeader label="Premium" sortKey="premiumCents" currentSortKey={sortKey} sortAsc={sortAsc} onClick={handleSort} />
                <TableHead>Lead Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No activity found for the selected filters
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map(row => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge variant={row.type === 'sale' ? 'default' : 'secondary'} className={row.type === 'sale' ? 'bg-green-600 hover:bg-green-700' : ''}>
                        {row.type === 'sale' ? 'Sale' : 'Quote'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(row.date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>{row.staffName}</TableCell>
                    <TableCell className="font-medium">{row.customer}</TableCell>
                    <TableCell>{row.zip}</TableCell>
                    <TableCell>{row.productType}</TableCell>
                    <TableCell className="text-right">{row.items}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.premiumCents)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.leadSource}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredAndSorted.length)} of {filteredAndSorted.length} records
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
