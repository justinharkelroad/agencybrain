import { useState, useMemo, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSubmissions, SubmissionFilters } from "@/hooks/useSubmissions";
import { SubmissionsFilterBar } from "./SubmissionsFilterBar";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SubmissionsListProps {
  staffAgencyId?: string | null;
}

type SortField = "form_name" | "team_member" | "work_date" | "submitted_at" | "status";
type SortDirection = "asc" | "desc";

const defaultFilters: SubmissionFilters = {
  searchQuery: '',
  dateRangePreset: 'all',
  formTemplateId: 'all',
  status: 'all',
};

export function SubmissionsList({ staffAgencyId }: SubmissionsListProps) {
  const [filters, setFilters] = useState<SubmissionFilters>(defaultFilters);
  const {
    submissions,
    loading,
    getDynamicKpiMetrics,
    formTemplateOptions,
    totalCount,
    filteredCount,
  } = useSubmissions(staffAgencyId || undefined, filters);
  const navigate = useNavigate();
  const location = useLocation();

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("submitted_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Sort data
  const sortedData = useMemo(() => {
    return [...submissions].sort((a, b) => {
      let aVal: string | number | boolean;
      let bVal: string | number | boolean;

      switch (sortField) {
        case "form_name":
          aVal = (a.form_templates?.name || "").toLowerCase();
          bVal = (b.form_templates?.name || "").toLowerCase();
          break;
        case "team_member":
          aVal = (a.team_members?.name || "").toLowerCase();
          bVal = (b.team_members?.name || "").toLowerCase();
          break;
        case "work_date":
          aVal = new Date(a.work_date || a.submission_date || a.submitted_at).getTime();
          bVal = new Date(b.work_date || b.submission_date || b.submitted_at).getTime();
          break;
        case "submitted_at":
          aVal = new Date(a.submitted_at).getTime();
          bVal = new Date(b.submitted_at).getTime();
          break;
        case "status":
          aVal = a.final ? 1 : 0;
          bVal = b.final ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (sortDirection === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
  }, [submissions, sortField, sortDirection]);

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredCount, pageSize]);

  // Paginate
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, sortedData.length);
  const paginatedData = sortedData.slice(startIndex, endIndex);

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

  const getInitials = (name: string | undefined): string => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-[300px]" />
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-[120px]" />
          <div className="flex-1" />
          <Skeleton className="h-10 w-[200px]" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="space-y-2 p-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No submissions yet</p>
            <p className="text-sm">
              Form submissions will appear here once team members start
              submitting data.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <SubmissionsFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        formTemplateOptions={formTemplateOptions}
        totalCount={totalCount}
        filteredCount={filteredCount}
        isLoading={loading}
      />

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <SortableHeader field="form_name">Form</SortableHeader>
                    <SortableHeader field="team_member">
                      Team Member
                    </SortableHeader>
                    <SortableHeader field="work_date">Work Date</SortableHeader>
                    <SortableHeader field="submitted_at">
                      Submitted
                    </SortableHeader>
                    <SortableHeader field="status" className="text-center">
                      Status
                    </SortableHeader>
                    <TableHead>Key Metrics</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        <p>No submissions match your filters</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((submission) => (
                      <TableRow
                        key={submission.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          const from = `${location.pathname}${location.search}`;
                          if (staffAgencyId) {
                            navigate(
                              `/staff/scorecards/submissions/${submission.id}`,
                              { state: { from } }
                            );
                          } else {
                            navigate(`/submissions/${submission.id}`, { state: { from } });
                          }
                        }}
                      >
                        <TableCell>
                          <div className="font-medium text-sm">
                            {submission.form_templates?.name || "Unknown Form"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {submission.form_templates?.slug}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getInitials(submission.team_members?.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">
                                {submission.team_members?.name ||
                                  "Unknown Member"}
                              </div>
                              <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {submission.team_members?.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(parseISO(submission.work_date || submission.submission_date || submission.submitted_at), "MMM d, yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(parseISO(submission.work_date || submission.submission_date || submission.submitted_at), "EEEE")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(
                              new Date(submission.submitted_at),
                              "MMM d, yyyy"
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(
                              new Date(submission.submitted_at),
                              "h:mm a"
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            {submission.final ? (
                              <Badge
                                variant="default"
                                className="flex items-center gap-1"
                              >
                                <CheckCircle className="h-3 w-3" />
                                Final
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Draft</Badge>
                            )}
                            {submission.late && (
                              <Badge
                                variant="destructive"
                                className="flex items-center gap-1"
                              >
                                <AlertCircle className="h-3 w-3" />
                                Late
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const metrics = getDynamicKpiMetrics(submission);
                            return (
                              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                                {metrics.map((metric, index) => (
                                  <div
                                    key={index}
                                    className="flex justify-between gap-2"
                                  >
                                    <span
                                      className="text-muted-foreground truncate"
                                      title={metric.label}
                                    >
                                      {metric.label}
                                    </span>
                                    <span className="font-mono font-medium tabular-nums">
                                      {metric.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {sortedData.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                {/* Record count */}
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{endIndex} of {sortedData.length}{" "}
                  submissions
                </div>

                {/* Page size selector and navigation */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Per page:
                    </span>
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

                  {/* Page navigation */}
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
        </CardContent>
      </Card>
    </div>
  );
}
