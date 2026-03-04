import { useEffect, useState } from 'react';
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
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Quote Date</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead className="text-right">Premium</TableHead>
                    <TableHead>Producer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHouseholds.map((household) => {
                    const products = (household.quotes || [])
                      .map((q) => q.product_type)
                      .filter(Boolean)
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
                        <TableCell className="text-sm max-w-[180px] truncate">
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
