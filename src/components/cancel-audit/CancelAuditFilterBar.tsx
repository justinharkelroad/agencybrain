import { Search, X, CircleDot, Flame, Archive, FileCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ReportType, RecordStatus } from '@/types/cancel-audit';
import type { ViewMode } from '@/hooks/useCancelAuditRecords';

interface FilterCounts {
  all: number;
  pending_cancel: number;
  cancellation: number;
}

interface CancelAuditFilterBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  needsAttentionCount: number;
  allRecordsCount: number;
  reportTypeFilter: ReportType | 'all';
  onReportTypeFilterChange: (filter: ReportType | 'all') => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  sortBy: 'urgency' | 'name' | 'date_added';
  onSortByChange: (sort: 'urgency' | 'name' | 'date_added') => void;
  counts: FilterCounts;
  isLoading?: boolean;
  statusFilter: RecordStatus | 'all';
  onStatusFilterChange: (status: RecordStatus | 'all') => void;
  showUntouchedOnly: boolean;
  onShowUntouchedOnlyChange: (show: boolean) => void;
  untouchedCount: number;
  showCurrentOnly: boolean;
  onShowCurrentOnlyChange: (show: boolean) => void;
  supersededCount: number;
}

export function CancelAuditFilterBar({
  viewMode,
  onViewModeChange,
  needsAttentionCount,
  allRecordsCount,
  reportTypeFilter,
  onReportTypeFilterChange,
  searchQuery,
  onSearchQueryChange,
  sortBy,
  onSortByChange,
  counts,
  isLoading = false,
  statusFilter,
  onStatusFilterChange,
  showUntouchedOnly,
  onShowUntouchedOnlyChange,
  untouchedCount,
  showCurrentOnly,
  onShowCurrentOnlyChange,
  supersededCount,
}: CancelAuditFilterBarProps) {
  const filterTabs: { value: ReportType | 'all'; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'pending_cancel', label: 'Pending Cancel', count: counts.pending_cancel },
    { value: 'cancellation', label: 'Cancelled', count: counts.cancellation },
  ];

  return (
    <div className="space-y-4">
      {/* View Mode Toggle - Primary/Prominent */}
      <div className="flex items-center gap-4">
        <div className="flex items-center bg-muted rounded-lg p-1">
          <Button
            variant={viewMode === 'needs_attention' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('needs_attention')}
            className={cn(
              'gap-2 rounded-md',
              viewMode === 'needs_attention' && 'bg-primary text-primary-foreground'
            )}
          >
            <Flame className="h-4 w-4" />
            Needs Attention
            <Badge 
              variant="secondary" 
              className={cn(
                'ml-1',
                viewMode === 'needs_attention' && 'bg-primary-foreground/20 text-primary-foreground'
              )}
            >
              {isLoading ? '-' : needsAttentionCount}
            </Badge>
          </Button>
          <Button
            variant={viewMode === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('all')}
            className={cn(
              'gap-2 rounded-md',
              viewMode === 'all' && 'bg-primary text-primary-foreground'
            )}
          >
            <Archive className="h-4 w-4" />
            All Records
            <Badge 
              variant="secondary"
              className={cn(
                'ml-1',
                viewMode === 'all' && 'bg-primary-foreground/20 text-primary-foreground'
              )}
            >
              {isLoading ? '-' : allRecordsCount}
            </Badge>
          </Button>
        </div>
      </div>

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

        {/* Current Records toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={showCurrentOnly}
                onPressedChange={onShowCurrentOnlyChange}
                size="sm"
                variant="outline"
                className={cn(
                  'gap-1.5',
                  showCurrentOnly && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                )}
              >
                <FileCheck className="h-3.5 w-3.5" />
                Current
                {supersededCount > 0 && !showCurrentOnly && (
                  <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-muted-foreground/10">
                    +{supersededCount}
                  </span>
                )}
              </Toggle>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>
                {showCurrentOnly 
                  ? `Showing records from latest uploads only. ${supersededCount > 0 ? `${supersededCount} superseded records hidden.` : ''}`
                  : 'Toggle to show only records from the latest uploads (hides superseded records from previous uploads)'
                }
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Untouched toggle */}
        <Toggle
          pressed={showUntouchedOnly}
          onPressedChange={onShowUntouchedOnlyChange}
          size="sm"
          variant="outline"
          className={cn(
            'gap-1.5',
            showUntouchedOnly && 'bg-orange-500/10 text-orange-400 border-orange-500/30'
          )}
        >
          <CircleDot className="h-3.5 w-3.5" />
          Untouched
          {untouchedCount > 0 && (
            <span className={cn(
              'ml-1 px-1.5 py-0.5 rounded text-xs',
              showUntouchedOnly 
                ? 'bg-orange-500/20 text-orange-400' 
                : 'bg-muted-foreground/10'
            )}>
              {untouchedCount}
            </span>
          )}
        </Toggle>

        {/* Status filter dropdown - only show in 'all' view mode */}
        {viewMode === 'all' && (
          <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as RecordStatus | 'all')}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        )}

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
