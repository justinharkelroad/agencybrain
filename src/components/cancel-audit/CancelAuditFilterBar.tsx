import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ReportType } from '@/types/cancel-audit';

interface FilterCounts {
  all: number;
  pending_cancel: number;
  cancellation: number;
}

interface CancelAuditFilterBarProps {
  reportTypeFilter: ReportType | 'all';
  onReportTypeFilterChange: (filter: ReportType | 'all') => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  sortBy: 'urgency' | 'name' | 'date_added';
  onSortByChange: (sort: 'urgency' | 'name' | 'date_added') => void;
  counts: FilterCounts;
  isLoading?: boolean;
}

export function CancelAuditFilterBar({
  reportTypeFilter,
  onReportTypeFilterChange,
  searchQuery,
  onSearchQueryChange,
  sortBy,
  onSortByChange,
  counts,
  isLoading = false,
}: CancelAuditFilterBarProps) {
  const filterTabs: { value: ReportType | 'all'; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'pending_cancel', label: 'Pending Cancel', count: counts.pending_cancel },
    { value: 'cancellation', label: 'Cancelled', count: counts.cancellation },
  ];

  return (
    <div className="space-y-4">
      {/* Main filter row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Report type toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {filterTabs.map((tab) => (
            <Button
              key={tab.value}
              variant="ghost"
              size="sm"
              onClick={() => onReportTypeFilterChange(tab.value)}
              className={cn(
                'rounded-md transition-all',
                reportTypeFilter === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              <span className={cn(
                'ml-1.5 px-1.5 py-0.5 rounded text-xs',
                reportTypeFilter === tab.value
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted-foreground/10'
              )}>
                {isLoading ? '-' : tab.count}
              </span>
            </Button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Sort dropdown */}
        <Select value={sortBy} onValueChange={(v) => onSortByChange(v as typeof sortBy)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgency">Urgency</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="date_added">Date Added</SelectItem>
          </SelectContent>
        </Select>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or policy..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchQueryChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {searchQuery && (
        <div className="text-sm text-muted-foreground">
          {isLoading ? (
            'Searching...'
          ) : (
            <>
              Found {counts.all} {counts.all === 1 ? 'record' : 'records'}
              {searchQuery && ` matching "${searchQuery}"`}
            </>
          )}
        </div>
      )}
    </div>
  );
}
