import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, CalendarIcon, X } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, startOfDay, endOfDay, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

export type WinbackStatus = 'all' | 'untouched' | 'in_progress' | 'won_back';
export type QuickDateFilter = 'all' | 'overdue' | 'this_week' | 'next_2_weeks' | 'next_month';

interface WinbackFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: WinbackStatus;
  onStatusChange: (value: WinbackStatus) => void;
  quickDateFilter: QuickDateFilter;
  onQuickDateChange: (value: QuickDateFilter) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onClearFilters: () => void;
}

const quickDateOptions: { value: QuickDateFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'this_week', label: 'This Week' },
  { value: 'next_2_weeks', label: 'Next 2 Weeks' },
  { value: 'next_month', label: 'Next Month' },
];

const statusOptions: { value: WinbackStatus; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'untouched', label: 'Untouched' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'won_back', label: 'Won Back' },
];

export function WinbackFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  quickDateFilter,
  onQuickDateChange,
  dateRange,
  onDateRangeChange,
  onClearFilters,
}: WinbackFiltersProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleQuickDateChange = (value: QuickDateFilter) => {
    onQuickDateChange(value);
    
    const today = startOfDay(new Date());
    
    switch (value) {
      case 'overdue':
        onDateRangeChange({
          from: new Date('2020-01-01'),
          to: subDays(today, 1),
        });
        break;
      case 'this_week':
        onDateRangeChange({
          from: startOfWeek(today, { weekStartsOn: 1 }),
          to: endOfWeek(today, { weekStartsOn: 1 }),
        });
        break;
      case 'next_2_weeks':
        onDateRangeChange({
          from: today,
          to: endOfDay(addWeeks(today, 2)),
        });
        break;
      case 'next_month':
        onDateRangeChange({
          from: today,
          to: endOfDay(addWeeks(today, 4)),
        });
        break;
      default:
        onDateRangeChange(undefined);
    }
  };

  const hasActiveFilters = search || statusFilter !== 'all' || quickDateFilter !== 'all' || dateRange;

  return (
    <div className="space-y-4">
      {/* Quick date filter tabs */}
      <div className="flex flex-wrap gap-2">
        {quickDateOptions.map((option) => (
          <Button
            key={option.value}
            variant={quickDateFilter === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickDateChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Search, Status, Date Range */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as WinbackStatus)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range Picker */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[240px] justify-start text-left font-normal',
                !dateRange && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
                  </>
                ) : (
                  format(dateRange.from, 'MMM d, yyyy')
                )
              ) : (
                'Winback date range'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={(range) => {
                onDateRangeChange(range);
                onQuickDateChange('all');
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={onClearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
