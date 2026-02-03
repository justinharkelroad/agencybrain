import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { DailyMetricRow } from "@/hooks/useSalespersonDailyMetrics";
import { cn } from "@/lib/utils";

interface VisibleMetric {
  slug: string;
  field: keyof DailyMetricRow;
  label: string;
}

interface SalespersonDailyReportTableProps {
  data: DailyMetricRow[];
  isLoading: boolean;
  visibleMetrics: VisibleMetric[];
  showNameColumn: boolean;
}

type SortField = "date" | "team_member_name" | "pass" | "daily_score" | "streak_count" | string;
type SortDirection = "asc" | "desc";

export function SalespersonDailyReportTable({
  data,
  isLoading,
  visibleMetrics,
  showNameColumn,
}: SalespersonDailyReportTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Sort data
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      // Handle special fields
      if (sortField === "date") {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      } else if (sortField === "team_member_name") {
        aVal = a.team_member_name.toLowerCase();
        bVal = b.team_member_name.toLowerCase();
      } else if (sortField === "pass") {
        aVal = a.pass ? 1 : 0;
        bVal = b.pass ? 1 : 0;
      } else {
        // For metric fields - check if it's a valid key
        const aRecord = a as Record<string, unknown>;
        const bRecord = b as Record<string, unknown>;
        aVal = (typeof aRecord[sortField] === "number" ? aRecord[sortField] : 0) as number;
        bVal = (typeof bRecord[sortField] === "number" ? bRecord[sortField] : 0) as number;
      }

      if (sortDirection === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
  }, [data, sortField, sortDirection]);

  // Paginate
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, sortedData.length);
  const paginatedData = sortedData.slice(startIndex, endIndex);

  // Reset to page 1 when data changes (using useEffect pattern in useMemo is intentional here)
  const dataLength = data.length;
  useMemo(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLength, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortableHeader = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={cn("cursor-pointer hover:bg-muted/50 select-none", className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl opacity-50 mb-3">📝</div>
        <div className="text-lg font-medium text-muted-foreground">No data for selected period</div>
        <div className="text-sm text-muted-foreground mt-1">
          Try adjusting your date range or team member filter.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader field="date">Date</SortableHeader>
                {showNameColumn && (
                  <SortableHeader field="team_member_name">Name</SortableHeader>
                )}
                {visibleMetrics.map((metric) => (
                  <SortableHeader key={metric.slug} field={metric.field} className="text-right">
                    {metric.label}
                  </SortableHeader>
                ))}
                <SortableHeader field="pass" className="text-center">
                  Pass
                </SortableHeader>
                <SortableHeader field="daily_score" className="text-right">
                  Score
                </SortableHeader>
                <SortableHeader field="streak_count" className="text-right">
                  Streak
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {format(new Date(row.date), "MMM d, yyyy")}
                  </TableCell>
                  {showNameColumn && (
                    <TableCell className="font-medium">{row.team_member_name}</TableCell>
                  )}
                  {visibleMetrics.map((metric) => {
                    const rowRecord = row as Record<string, unknown>;
                    const value = typeof rowRecord[metric.field] === "number"
                      ? (rowRecord[metric.field] as number).toLocaleString()
                      : 0;
                    return (
                      <TableCell key={metric.slug} className="text-right tabular-nums">
                        {value}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center">
                    <Badge variant={row.pass ? "default" : "secondary"}>
                      {row.pass ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.daily_score}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{row.streak_count}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {sortedData.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            {/* Record count */}
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{endIndex} of {sortedData.length} records
            </div>

            {/* Page size selector and navigation */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Per page:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setCurrentPage(1);
                  }}
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
                    onClick={() => setCurrentPage((prev) => prev - 1)}
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
                    onClick={() => setCurrentPage((prev) => prev + 1)}
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
