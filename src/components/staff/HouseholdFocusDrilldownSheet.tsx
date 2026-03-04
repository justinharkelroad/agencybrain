import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface DrilldownHousehold {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  first_quote_date: string | null;
  zip_code: string | null;
  team_member: { name: string } | null;
  lead_source: { name: string } | null;
  quotes: Array<{
    product_type: string | null;
    items_quoted: number | null;
    premium_cents: number | null;
  }>;
}

interface HouseholdFocusDrilldownSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  households: DrilldownHousehold[];
  loading: boolean;
  title: string;
}

/** "Bundle" is a packaging flag, not a real product line — always exclude from display */
const EXCLUDED_PRODUCT_TYPES = new Set(['bundle']);

function isRealProduct(productType: string | null): boolean {
  if (!productType) return false;
  return !EXCLUDED_PRODUCT_TYPES.has(productType.toLowerCase());
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    lead: 'bg-blue-500/15 text-blue-500 border-blue-500/50 dark:border-blue-500/30',
    quoted: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    sold: 'bg-green-500/15 text-green-500 border-green-500/50 dark:border-green-500/30',
  };

  return (
    <Badge variant="outline" className={cn('capitalize', colors[status] || '')}>
      {status}
    </Badge>
  );
}

function SummaryCards({ households }: { households: DrilldownHousehold[] }) {
  const stats = useMemo(() => {
    const bySource: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byProducer: Record<string, number> = {};

    for (const h of households) {
      const source = h.lead_source?.name || 'Unknown';
      bySource[source] = (bySource[source] || 0) + 1;

      byStatus[h.status] = (byStatus[h.status] || 0) + 1;

      const producer = h.team_member?.name || 'Unassigned';
      byProducer[producer] = (byProducer[producer] || 0) + 1;
    }

    // Sort each by count desc, take top entries
    const sortDesc = (obj: Record<string, number>) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]);

    return {
      sources: sortDesc(bySource),
      statuses: sortDesc(byStatus),
      producers: sortDesc(byProducer),
    };
  }, [households]);

  const quotedCount = stats.statuses.find(([s]) => s === 'quoted')?.[1] ?? 0;
  const soldCount = stats.statuses.find(([s]) => s === 'sold')?.[1] ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-1">
      {/* Status breakdown */}
      <div className="rounded-lg border border-border/50 bg-card/50 p-2.5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Status</p>
        <div className="flex items-baseline gap-3">
          {quotedCount > 0 && (
            <span className="text-sm">
              <span className="font-semibold text-amber-500">{quotedCount}</span>
              <span className="text-muted-foreground ml-1">quoted</span>
            </span>
          )}
          {soldCount > 0 && (
            <span className="text-sm">
              <span className="font-semibold text-green-500">{soldCount}</span>
              <span className="text-muted-foreground ml-1">sold</span>
            </span>
          )}
        </div>
      </div>

      {/* Top lead sources */}
      <div className="rounded-lg border border-border/50 bg-card/50 p-2.5 col-span-1 sm:col-span-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Lead Sources</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {stats.sources.slice(0, 5).map(([name, count]) => (
            <span key={name} className="text-sm">
              <span className="font-semibold">{count}</span>
              <span className="text-muted-foreground ml-1">{name}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Producer breakdown — only show if multiple producers */}
      {stats.producers.length > 1 && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-2.5 col-span-2 sm:col-span-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">By Producer</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {stats.producers.map(([name, count]) => (
              <span key={name} className="text-sm">
                <span className="font-semibold">{count}</span>
                <span className="text-muted-foreground ml-1">{name}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ITEMS_PER_PAGE = 50;

export function HouseholdFocusDrilldownSheet({
  open,
  onOpenChange,
  households,
  loading,
  title,
}: HouseholdFocusDrilldownSheetProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when data changes (e.g. fresh fetch for different period/member)
  useEffect(() => {
    setCurrentPage(1);
  }, [households]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setCurrentPage(1);
    }
    onOpenChange(isOpen);
  };

  const totalPages = Math.ceil(households.length / ITEMS_PER_PAGE);
  const paginatedHouseholds = households.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            {title}
          </SheetTitle>
          {!loading && (
            <p className="text-sm text-muted-foreground">
              {households.length} {households.length === 1 ? 'household' : 'households'}
            </p>
          )}
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : households.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No households found for this period.
          </div>
        ) : (
          <>
            <SummaryCards households={households} />

            <ScrollArea className="flex-1 mt-2">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Quote Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead className="text-right">Premium</TableHead>
                    <TableHead>Producer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHouseholds.map((household) => {
                    const products = (household.quotes || [])
                      .map((q) => q.product_type)
                      .filter(isRealProduct)
                      .join(', ');
                    const totalPremium = (household.quotes || [])
                      .reduce((sum, q) => sum + (q.premium_cents || 0), 0);

                    return (
                      <TableRow key={household.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {[household.first_name, household.last_name].filter(Boolean).join(' ') || '-'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={household.status} />
                        </TableCell>
                        <TableCell>{formatDate(household.first_quote_date)}</TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate">
                          {household.lead_source?.name || '-'}
                        </TableCell>
                        <TableCell className="text-sm max-w-[160px] truncate">
                          {products || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {totalPremium > 0 ? formatDollars(totalPremium) : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {household.team_member?.name || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} ({households.length} households)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
