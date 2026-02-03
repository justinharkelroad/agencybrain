import { useState, useEffect } from 'react';
import { Search, X, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  SubmissionFilters,
  DateRangePreset,
  StatusFilter,
  FormTemplateOption
} from '@/hooks/useSubmissions';

interface SubmissionsFilterBarProps {
  filters: SubmissionFilters;
  onFiltersChange: (filters: SubmissionFilters) => void;
  formTemplateOptions: FormTemplateOption[];
  totalCount: number;
  filteredCount: number;
  isLoading?: boolean;
}

const datePresetLabels: Record<DateRangePreset, string> = {
  all: 'All Time',
  this_week: 'This Week',
  last_week: 'Last Week',
  this_month: 'This Month',
  last_30_days: 'Last 30 Days',
  custom: 'Custom',
};

export function SubmissionsFilterBar({
  filters,
  onFiltersChange,
  formTemplateOptions,
  totalCount,
  filteredCount,
  isLoading = false,
}: SubmissionsFilterBarProps) {
  // Debounced search state
  const [searchInput, setSearchInput] = useState(filters.searchQuery);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.searchQuery) {
        onFiltersChange({ ...filters, searchQuery: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Sync searchInput when filters.searchQuery changes externally
  useEffect(() => {
    setSearchInput(filters.searchQuery);
  }, [filters.searchQuery]);

  const handleDatePresetChange = (preset: DateRangePreset) => {
    onFiltersChange({ ...filters, dateRangePreset: preset });
  };

  const handleFormTemplateChange = (value: string) => {
    onFiltersChange({ ...filters, formTemplateId: value });
  };

  const handleStatusChange = (value: StatusFilter) => {
    onFiltersChange({ ...filters, status: value });
  };

  const clearFilters = () => {
    setSearchInput('');
    onFiltersChange({
      searchQuery: '',
      dateRangePreset: 'all',
      formTemplateId: 'all',
      status: 'all',
    });
  };

  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.dateRangePreset !== 'all' ||
    filters.formTemplateId !== 'all' ||
    filters.status !== 'all';

  const datePresets: DateRangePreset[] = ['all', 'this_week', 'last_week', 'this_month', 'last_30_days'];

  return (
    <div className="space-y-4">
      {/* Main filter row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
        {/* Date range presets */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {datePresets.map((preset) => (
            <Button
              key={preset}
              variant="ghost"
              size="sm"
              onClick={() => handleDatePresetChange(preset)}
              className={cn(
                'rounded-md transition-all text-xs px-2.5',
                filters.dateRangePreset === preset
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Calendar className="h-3 w-3 mr-1.5 hidden sm:inline" />
              {datePresetLabels[preset]}
            </Button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Form template filter */}
        <Select value={filters.formTemplateId} onValueChange={handleFormTemplateChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Forms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Forms</SelectItem>
            {formTemplateOptions.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={filters.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="final">Final</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>

        {/* Search input */}
        <div className="relative w-full lg:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team member..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {isLoading ? (
          'Loading submissions...'
        ) : hasActiveFilters ? (
          <>
            Showing{' '}
            <Badge variant="secondary" className="font-mono">
              {filteredCount}
            </Badge>{' '}
            of {totalCount} submissions
            {filters.searchQuery && (
              <span className="text-muted-foreground">
                matching "<span className="font-medium">{filters.searchQuery}</span>"
              </span>
            )}
          </>
        ) : (
          <>
            <Badge variant="secondary" className="font-mono">
              {totalCount}
            </Badge>{' '}
            submissions
          </>
        )}
      </div>
    </div>
  );
}
