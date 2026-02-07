import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
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
import { useLqsHouseholdById } from '@/hooks/useLqsHouseholdById';
import { LqsHouseholdDetailModal } from './LqsHouseholdDetailModal';
import { format } from 'date-fns';
import type { FilteredHousehold } from '@/hooks/useLqsTimeToClose';

interface LqsTimeToCloseDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  households: FilteredHousehold[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    lead: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    quoted: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    sold: 'bg-green-500/10 text-green-500 border-green-500/30',
  };

  return (
    <Badge variant="outline" className={cn('capitalize', colors[status] || '')}>
      {status}
    </Badge>
  );
}

const ITEMS_PER_PAGE = 50;

export function LqsTimeToCloseDetailSheet({
  open,
  onOpenChange,
  title,
  households,
}: LqsTimeToCloseDetailSheetProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);

  const { data: selectedHousehold } = useLqsHouseholdById(selectedHouseholdId);

  // Reset page when sheet reopens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setCurrentPage(1);
      setSelectedHouseholdId(null);
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
            <Clock className="h-5 w-5" />
            {title}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {households.length} {households.length === 1 ? 'household' : 'households'}
          </p>
        </SheetHeader>

        {households.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No households found.
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
                    <TableHead>Sold Date</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Producer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHouseholds.map((household) => (
                    <TableRow
                      key={household.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedHouseholdId(household.id)}
                    >
                      <TableCell className="font-medium">
                        {household.customerName}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={household.status} />
                      </TableCell>
                      <TableCell>{formatDate(household.firstQuoteDate)}</TableCell>
                      <TableCell>{formatDate(household.soldDate)}</TableCell>
                      <TableCell className="text-right">
                        {household.daysToClose !== null ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              household.daysToClose <= 14
                                ? 'border-green-500/30 text-green-500'
                                : household.daysToClose <= 30
                                ? 'border-amber-500/30 text-amber-500'
                                : 'border-red-500/30 text-red-500'
                            )}
                          >
                            {household.daysToClose}d
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{household.leadSourceName}</TableCell>
                      <TableCell className="text-sm">{household.producerName}</TableCell>
                    </TableRow>
                  ))}
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
