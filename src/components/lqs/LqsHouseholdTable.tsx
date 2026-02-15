import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react';
import { LqsHouseholdRow } from './LqsHouseholdRow';
import { HouseholdWithRelations } from '@/hooks/useLqsData';
import { filterCountableQuotes } from '@/lib/lqs-constants';

type SortDirection = 'asc' | 'desc';
type SortColumn = 'name' | 'zip' | 'products' | 'premium' | 'leadSource' | 'objection' | 'producer' | 'status';

interface SortCriterion {
  column: SortColumn;
  direction: SortDirection;
}

function formatHouseholdName(household: HouseholdWithRelations): string {
  const first = (household.first_name || '').trim();
  const last = (household.last_name || '').trim();
  if (first && last) return `${last.toUpperCase()}, ${first}`;
  if (last) return last.toUpperCase();
  if (first) return first;
  return 'Unknown';
}

function formatStatus(status: string | null | undefined): string {
  const value = (status || '').trim();
  if (!value) return '';
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

interface LqsHouseholdTableProps {
  households: HouseholdWithRelations[];
  loading?: boolean;
  onAssignLeadSource: (householdId: string) => void;
  onBulkAssign?: (householdIds: string[]) => void;
  showBulkSelect?: boolean;
  onViewHouseholdDetail?: (household: HouseholdWithRelations) => void;
  onViewSaleDetail?: (saleId: string) => void;
  onViewProfile?: (household: HouseholdWithRelations) => void;
  // Pagination props
  totalRecords?: number;
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  startRecord?: number;
  endRecord?: number;
}

export function LqsHouseholdTable({
  households,
  loading,
  onAssignLeadSource,
  onBulkAssign,
  showBulkSelect = false,
  onViewHouseholdDetail,
  onViewSaleDetail,
  onViewProfile,
  totalRecords,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  startRecord,
  endRecord,
}: LqsHouseholdTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);

  // Only households needing attention can be bulk assigned
  const selectableHouseholds = useMemo(
    () => households.filter(h => h.needs_attention),
    [households]
  );

  const allSelected = selectableHouseholds.length > 0 && 
    selectableHouseholds.every(h => selectedIds.has(h.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(selectableHouseholds.map(h => h.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkAssign = () => {
    if (onBulkAssign && selectedIds.size > 0) {
      onBulkAssign(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const getRowValues = (household: HouseholdWithRelations) => {
    const isSold = household.status === 'sold';
    const sales = household.sales || [];
    const countableQuotes = filterCountableQuotes(household.quotes || []);

    const uniqueProducts = isSold && sales.length > 0
      ? [...new Set(sales.map(s => s.product_type))]
      : [...new Set(countableQuotes.map(q => q.product_type))];

    const totalPremium = isSold && sales.length > 0
      ? sales.reduce((sum, s) => sum + (s.premium_cents || 0), 0)
      : countableQuotes.reduce((sum, q) => sum + (q.premium_cents || 0), 0);

    return {
      name: formatHouseholdName(household).toLowerCase(),
      zip: (household.zip_code || '').toLowerCase(),
      products: uniqueProducts.join(', ').toLowerCase(),
      premium: totalPremium,
      leadSource: (household.lead_source?.name || '').toLowerCase(),
      objection: (household.objection?.name || '').toLowerCase(),
      producer: (household.team_member?.name || '').toLowerCase(),
      status: (household.status || '').toLowerCase(),
      exportProducts: uniqueProducts.join(', '),
      exportPremium: (totalPremium / 100).toLocaleString(),
    };
  };

  const sortedHouseholds = useMemo(() => {
    if (sortCriteria.length === 0) return households;

    return [...households].sort((a, b) => {
      const aValues = getRowValues(a);
      const bValues = getRowValues(b);

      for (const criterion of sortCriteria) {
        let cmp = 0;

        if (criterion.column === 'premium') {
          cmp = (aValues.premium as number) - (bValues.premium as number);
        } else {
          const aVal = aValues[criterion.column];
          const bVal = bValues[criterion.column];
          cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
        }

        if (cmp !== 0) {
          return criterion.direction === 'asc' ? cmp : -cmp;
        }
      }
      return 0;
    });
  }, [households, sortCriteria]);

  const updateSort = (column: SortColumn, useMultiSort: boolean) => {
    setSortCriteria(prev => {
      const existingIndex = prev.findIndex(c => c.column === column);

      if (!useMultiSort) {
        if (existingIndex === -1) return [{ column, direction: 'asc' }];
        const existing = prev[existingIndex];
        return [{ column, direction: existing.direction === 'asc' ? 'desc' : 'asc' }];
      }

      if (existingIndex === -1) {
        return [...prev, { column, direction: 'asc' }];
      }

      const next = [...prev];
      const existing = next[existingIndex];
      next[existingIndex] = {
        ...existing,
        direction: existing.direction === 'asc' ? 'desc' : 'asc',
      };
      return next;
    });
  };

  const getSortState = (column: SortColumn) => {
    const index = sortCriteria.findIndex(c => c.column === column);
    if (index === -1) return null;
    return { ...sortCriteria[index], priority: index + 1 };
  };

  const renderSortIndicator = (column: SortColumn) => {
    const sortState = getSortState(column);
    if (!sortState) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />;
    }

    return (
      <span className="inline-flex items-center gap-1">
        {sortState.direction === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )}
        {sortCriteria.length > 1 && (
          <span className="text-[10px] text-muted-foreground">
            {sortState.priority}
          </span>
        )}
      </span>
    );
  };

  const downloadCurrentPageCsv = () => {
    if (sortedHouseholds.length === 0) {
      toast.error('No rows to export');
      return;
    }

    const escapeCsv = (value: string | number | null | undefined) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = ['Name', 'ZIP', 'Products', 'Premium', 'Lead Source', 'Objection', 'Producer', 'Status'];
    const rows = sortedHouseholds.map((household) => {
      const values = getRowValues(household);
      const displayName = formatHouseholdName(household);
      return [
        escapeCsv(displayName),
        escapeCsv(household.zip_code || ''),
        escapeCsv(values.exportProducts),
        escapeCsv(`$${values.exportPremium}`),
        escapeCsv(household.lead_source?.name || ''),
        escapeCsv(household.objection?.name || ''),
        escapeCsv(household.team_member?.name || ''),
        escapeCsv(formatStatus(household.status)),
      ];
    });

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lqs-roadmap-page-${currentPage || 1}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Current page exported');
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (households.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No households found matching your filters.
      </div>
    );
  }

  const showPagination = totalRecords !== undefined && totalRecords > 0 && totalPages !== undefined;

  return (
    <div className="space-y-2">
      {/* Bulk Action Bar */}
      {showBulkSelect && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button size="sm" onClick={handleBulkAssign}>
            Assign Selected ({selectedIds.size})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {showBulkSelect && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    disabled={selectableHouseholds.length === 0}
                  />
                </TableHead>
              )}
              <TableHead className="w-10" />
              <TableHead>
                <button type="button" title="Click to sort. Shift+Click to multi-sort." className="inline-flex items-center gap-1.5" onClick={(e) => updateSort('name', e.shiftKey)}>
                  Name
                  {renderSortIndicator('name')}
                </button>
              </TableHead>
              <TableHead>
                <button type="button" title="Click to sort. Shift+Click to multi-sort." className="inline-flex items-center gap-1.5" onClick={(e) => updateSort('zip', e.shiftKey)}>
                  ZIP
                  {renderSortIndicator('zip')}
                </button>
              </TableHead>
              <TableHead>
                <button type="button" title="Click to sort. Shift+Click to multi-sort." className="inline-flex items-center gap-1.5" onClick={(e) => updateSort('products', e.shiftKey)}>
                  Products
                  {renderSortIndicator('products')}
                </button>
              </TableHead>
              <TableHead>
                <button type="button" title="Click to sort. Shift+Click to multi-sort." className="inline-flex items-center gap-1.5" onClick={(e) => updateSort('premium', e.shiftKey)}>
                  Premium
                  {renderSortIndicator('premium')}
                </button>
              </TableHead>
              <TableHead>
                <button type="button" title="Click to sort. Shift+Click to multi-sort." className="inline-flex items-center gap-1.5" onClick={(e) => updateSort('leadSource', e.shiftKey)}>
                  Lead Source
                  {renderSortIndicator('leadSource')}
                </button>
              </TableHead>
              <TableHead>
                <button type="button" title="Click to sort. Shift+Click to multi-sort." className="inline-flex items-center gap-1.5" onClick={(e) => updateSort('objection', e.shiftKey)}>
                  Objection
                  {renderSortIndicator('objection')}
                </button>
              </TableHead>
              <TableHead>
                <button type="button" title="Click to sort. Shift+Click to multi-sort." className="inline-flex items-center gap-1.5" onClick={(e) => updateSort('producer', e.shiftKey)}>
                  Producer
                  {renderSortIndicator('producer')}
                </button>
              </TableHead>
              <TableHead>
                <button type="button" title="Click to sort. Shift+Click to multi-sort." className="inline-flex items-center gap-1.5" onClick={(e) => updateSort('status', e.shiftKey)}>
                  Status
                  {renderSortIndicator('status')}
                </button>
              </TableHead>
              <TableHead className="w-10" />
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHouseholds.map(household => (
              <LqsHouseholdRow
                key={household.id}
                household={household}
                onAssignLeadSource={onAssignLeadSource}
                isSelected={selectedIds.has(household.id)}
                onSelectChange={(checked) => handleSelectOne(household.id, checked)}
                showCheckbox={showBulkSelect && household.needs_attention}
                onViewDetail={onViewHouseholdDetail}
                onViewSaleDetail={onViewSaleDetail}
                onViewProfile={onViewProfile}
              />
            ))}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        {showPagination && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            {/* Record count */}
            <div className="text-sm text-muted-foreground">
              Showing {startRecord}-{endRecord} of {totalRecords} records
            </div>
            
            {/* Page size selector and navigation */}
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={downloadCurrentPageCsv}>
                <Download className="h-4 w-4 mr-2" />
                Export Page CSV
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Per page:</span>
                <Select 
                  value={String(pageSize)} 
                  onValueChange={(v) => onPageSizeChange?.(Number(v))}
                >
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Page navigation - only show if more than 1 page */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => onPageChange?.(currentPage! - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => onPageChange?.(currentPage! + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
