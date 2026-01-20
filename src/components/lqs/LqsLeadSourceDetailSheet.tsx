import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Users, Target, DollarSign, ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLqsLeadSourceDetail, HouseholdDetailRow } from '@/hooks/useLqsLeadSourceDetail';
import { useLqsHouseholdById } from '@/hooks/useLqsHouseholdById';
import { LqsHouseholdDetailModal } from './LqsHouseholdDetailModal';
import { format, differenceInDays } from 'date-fns';

interface LqsLeadSourceDetailSheetProps {
  agencyId: string | null;
  leadSourceId: string | null | undefined;
  dateRange: { start: Date; end: Date } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Format currency from cents
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// Format date
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

// Temperature rating calculation
// Returns 1-3 fires based on quote recency for unsold households
function calculateTemperature(household: HouseholdDetailRow): number {
  // Only show temperature for quoted (not yet sold) households
  if (household.status !== 'quoted' || household.quotedPolicies === 0) return 0;

  // Find the most recent quote date
  const quoteDates = household.quotes
    .map(q => q.quoteDate)
    .filter(Boolean)
    .map(d => new Date(d));

  if (quoteDates.length === 0) return 0;

  const mostRecentQuote = new Date(Math.max(...quoteDates.map(d => d.getTime())));
  const daysAgo = differenceInDays(new Date(), mostRecentQuote);

  // Temperature thresholds
  if (daysAgo <= 7) return 3;   // Hot - 3 fires
  if (daysAgo <= 14) return 2;  // Warm - 2 fires
  if (daysAgo <= 30) return 1;  // Cool - 1 fire
  return 0;                     // Cold - no fires
}

// Temperature display component
function TemperatureRating({ temperature }: { temperature: number }) {
  if (temperature === 0) return <span className="text-muted-foreground">-</span>;

  const fires = Array.from({ length: temperature }, (_, i) => i);
  const labels = {
    3: 'Hot lead - quoted within 7 days',
    2: 'Warm lead - quoted within 14 days',
    1: 'Cool lead - quoted within 30 days',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">
            {fires.map((_, i) => (
              <span key={i} className="text-orange-500">🔥</span>
            ))}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{labels[temperature as 1 | 2 | 3]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Status badge component
function StatusBadge({ status }: { status: string | null }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
    lead: 'secondary',
    quoted: 'default',
    sold: 'default',
  };

  const colors: Record<string, string> = {
    lead: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    quoted: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    sold: 'bg-green-500/10 text-green-500 border-green-500/30',
  };

  return (
    <Badge
      variant="outline"
      className={cn('capitalize', colors[status || 'lead'] || '')}
    >
      {status || 'lead'}
    </Badge>
  );
}

// Expanded detail content for a household
function HouseholdDetailContent({ household }: { household: HouseholdDetailRow }) {
  return (
    <div className="p-4 space-y-4">
      {/* Quotes Section */}
      {household.quotes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-amber-500" />
            Quotes ({household.quotes.length})
          </h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Product</th>
                  <th className="text-right p-2">Items</th>
                  <th className="text-right p-2">Premium</th>
                  <th className="text-left p-2">Quoted By</th>
                </tr>
              </thead>
              <tbody>
                {household.quotes.map((q, idx) => (
                  <tr key={idx} className="border-t border-border/50">
                    <td className="p-2">{formatDate(q.quoteDate)}</td>
                    <td className="p-2">{q.productType}</td>
                    <td className="p-2 text-right">{q.itemsQuoted}</td>
                    <td className="p-2 text-right">{formatCurrency(q.premiumCents)}</td>
                    <td className="p-2">{q.teamMemberName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sales Section */}
      {household.sales.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            Sales ({household.sales.length})
          </h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Product</th>
                  <th className="text-right p-2">Policies</th>
                  <th className="text-right p-2">Items</th>
                  <th className="text-right p-2">Premium</th>
                  <th className="text-left p-2">Sold By</th>
                </tr>
              </thead>
              <tbody>
                {household.sales.map((s, idx) => (
                  <tr key={idx} className="border-t border-border/50">
                    <td className="p-2">{formatDate(s.saleDate)}</td>
                    <td className="p-2">{s.productType}</td>
                    <td className="p-2 text-right">{s.policiesSold}</td>
                    <td className="p-2 text-right">{s.itemsSold}</td>
                    <td className="p-2 text-right text-green-500">{formatCurrency(s.premiumCents)}</td>
                    <td className="p-2">{s.teamMemberName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {household.quotes.length === 0 && household.sales.length === 0 && (
        <div className="text-center text-muted-foreground py-4">
          No quotes or sales yet
        </div>
      )}
    </div>
  );
}

const ITEMS_PER_PAGE = 50;

export function LqsLeadSourceDetailSheet({
  agencyId,
  leadSourceId,
  dateRange,
  open,
  onOpenChange,
}: LqsLeadSourceDetailSheetProps) {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);

  // Fetch full household data when a name is clicked
  const { data: selectedHousehold, isLoading: isLoadingHousehold } = useLqsHouseholdById(selectedHouseholdId);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOpenHouseholdDetail = (householdId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger row expand/collapse
    setSelectedHouseholdId(householdId);
  };

  const { data, isLoading, error } = useLqsLeadSourceDetail(
    agencyId,
    open ? leadSourceId : undefined, // Only fetch when open
    dateRange
  );

  // Filter households by status
  const filteredHouseholds = data?.households.filter(h => {
    if (!statusFilter) return true;
    return h.status === statusFilter;
  }) || [];

  // Paginate
  const totalPages = Math.ceil(filteredHouseholds.length / ITEMS_PER_PAGE);
  const paginatedHouseholds = filteredHouseholds.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filter changes
  const handleStatusFilter = (status: string | null) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isLoading ? 'Loading...' : (data?.leadSourceName || 'Lead Source Details')}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-destructive">
            Failed to load data
          </div>
        ) : data ? (
          <>
            {/* Summary Cards - Clickable for filtering */}
            <div className="grid grid-cols-4 gap-4 p-4 border-b">
              <div
                className={cn(
                  "text-center cursor-pointer rounded-lg p-2 transition-colors",
                  statusFilter === null ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-muted"
                )}
                onClick={() => handleStatusFilter(null)}
              >
                <div className="text-2xl font-bold">{data.summary.totalHouseholds}</div>
                <div className="text-xs text-muted-foreground">Total HH</div>
              </div>
              <div
                className={cn(
                  "text-center cursor-pointer rounded-lg p-2 transition-colors",
                  statusFilter === 'lead' ? "bg-blue-500/20 ring-2 ring-blue-500" : "hover:bg-muted"
                )}
                onClick={() => handleStatusFilter('lead')}
              >
                <div className="text-2xl font-bold text-blue-500">{data.summary.leadsCount}</div>
                <div className="text-xs text-muted-foreground">Leads</div>
              </div>
              <div
                className={cn(
                  "text-center cursor-pointer rounded-lg p-2 transition-colors",
                  statusFilter === 'quoted' ? "bg-amber-500/20 ring-2 ring-amber-500" : "hover:bg-muted"
                )}
                onClick={() => handleStatusFilter('quoted')}
              >
                <div className="text-2xl font-bold text-amber-500">{data.summary.quotedCount}</div>
                <div className="text-xs text-muted-foreground">Quoted</div>
              </div>
              <div
                className={cn(
                  "text-center cursor-pointer rounded-lg p-2 transition-colors",
                  statusFilter === 'sold' ? "bg-green-500/20 ring-2 ring-green-500" : "hover:bg-muted"
                )}
                onClick={() => handleStatusFilter('sold')}
              >
                <div className="text-2xl font-bold text-green-500">{data.summary.soldCount}</div>
                <div className="text-xs text-muted-foreground">Sold</div>
              </div>
            </div>

            {/* Premium Summary */}
            <div className="flex justify-between p-4 bg-muted/30 text-sm">
              <div>
                <span className="text-muted-foreground">Quoted Premium:</span>{' '}
                <span className="font-medium">{formatCurrency(data.summary.totalQuotedPremiumCents)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Written Premium:</span>{' '}
                <span className="font-medium text-green-500">{formatCurrency(data.summary.totalSoldPremiumCents)}</span>
              </div>
            </div>

            {/* Filter indicator */}
            {statusFilter && (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                Showing {filteredHouseholds.length} {statusFilter} households
              </div>
            )}

            {/* Households Table */}
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead style={{ width: 180 }}>Household</TableHead>
                    <TableHead style={{ width: 80 }}>Status</TableHead>
                    <TableHead style={{ width: 60 }}>Temp</TableHead>
                    <TableHead style={{ width: 100 }}>Lead Date</TableHead>
                    <TableHead style={{ width: 100 }}>Quoted</TableHead>
                    <TableHead style={{ width: 100 }}>Sold</TableHead>
                    <TableHead style={{ width: 100 }} className="text-right">Premium</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHouseholds.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No households found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedHouseholds.flatMap((household) => {
                      const temperature = calculateTemperature(household);
                      const isExpanded = expandedIds.has(household.id);

                      return [
                        <TableRow
                          key={`row-${household.id}`}
                          className="hover:bg-muted/50 cursor-pointer group"
                          onClick={() => toggleExpanded(household.id)}
                        >
                          <TableCell style={{ width: 180 }}>
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0" />
                              )}
                              <button
                                onClick={(e) => handleOpenHouseholdDetail(household.id, e)}
                                className="font-medium truncate text-left hover:text-primary hover:underline transition-colors"
                              >
                                {household.firstName} {household.lastName}
                              </button>
                              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                          </TableCell>
                          <TableCell style={{ width: 80 }}>
                            <StatusBadge status={household.status} />
                          </TableCell>
                          <TableCell style={{ width: 60 }}>
                            <TemperatureRating temperature={temperature} />
                          </TableCell>
                          <TableCell style={{ width: 100 }}>{formatDate(household.leadReceivedDate)}</TableCell>
                          <TableCell style={{ width: 100 }}>
                            {household.quotedPolicies > 0 ? (
                              <span className="text-amber-500">
                                {household.quotedPolicies} pol / {household.quotedItems} items
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell style={{ width: 100 }}>
                            {household.soldPolicies > 0 ? (
                              <span className="text-green-500">
                                {household.soldPolicies} pol / {household.soldItems} items
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell style={{ width: 100 }} className="text-right font-medium text-green-500">
                            {household.soldPremiumCents > 0 ? formatCurrency(household.soldPremiumCents) : '-'}
                          </TableCell>
                        </TableRow>,
                        ...(isExpanded ? [
                          <TableRow key={`detail-${household.id}`} className="bg-muted/30">
                            <TableCell colSpan={7} className="p-0">
                              <HouseholdDetailContent household={household} />
                            </TableCell>
                          </TableRow>
                        ] : [])
                      ];
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} ({filteredHouseholds.length} households)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </SheetContent>

      {/* Household Detail Modal - opens on name click */}
      <LqsHouseholdDetailModal
        household={selectedHousehold || null}
        open={!!selectedHouseholdId}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedHouseholdId(null);
        }}
      />
    </Sheet>
  );
}
