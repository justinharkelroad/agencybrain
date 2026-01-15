import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { LqsLeadSource } from '@/hooks/useLqsData';

interface LqsFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  dateRange: { start: Date; end: Date } | null;
  onDateRangeChange: (range: { start: Date; end: Date } | null) => void;
  // Lead source filter props
  leadSources?: LqsLeadSource[];
  selectedLeadSourceId?: string;
  onLeadSourceChange?: (value: string) => void;
}

export function LqsFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  dateRange,
  onDateRangeChange,
  leadSources,
  selectedLeadSourceId,
  onLeadSourceChange,
}: LqsFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchTerm);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  const handleClearFilters = () => {
    setLocalSearch('');
    onSearchChange('');
    onStatusChange('all');
    onDateRangeChange(null);
    onLeadSourceChange?.('all');
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || dateRange || 
    (selectedLeadSourceId && selectedLeadSourceId !== 'all');

  // Group lead sources by bucket
  const groupedLeadSources = leadSources?.reduce((groups, source) => {
    const bucketName = source.bucket?.name || 'Uncategorized';
    if (!groups[bucketName]) groups[bucketName] = [];
    groups[bucketName].push(source);
    return groups;
  }, {} as Record<string, LqsLeadSource[]>) || {};

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-10 w-64"
        />
      </div>

      {/* Date Range Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start text-left font-normal w-[240px]',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.start && dateRange?.end ? (
              <>
                {format(dateRange.start, 'MMM d, yyyy')} - {format(dateRange.end, 'MMM d, yyyy')}
              </>
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            selected={dateRange ? { from: dateRange.start, to: dateRange.end } : undefined}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                onDateRangeChange({ start: range.from, end: range.to });
              } else if (range?.from) {
                onDateRangeChange({ start: range.from, end: range.from });
              } else {
                onDateRangeChange(null);
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="lead">Open Lead</SelectItem>
          <SelectItem value="quoted">Quoted</SelectItem>
          <SelectItem value="sold">Sold</SelectItem>
        </SelectContent>
      </Select>

      {/* Lead Source Filter */}
      {leadSources && onLeadSourceChange && (
        <Select value={selectedLeadSourceId || 'all'} onValueChange={onLeadSourceChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Lead Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lead Sources</SelectItem>
            {Object.entries(groupedLeadSources).map(([bucketName, sources]) => (
              <SelectGroup key={bucketName}>
                <SelectLabel>{bucketName}</SelectLabel>
                {sources.map(source => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleClearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
