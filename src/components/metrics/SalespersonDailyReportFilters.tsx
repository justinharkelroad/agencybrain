import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, X, Download } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  subWeeks,
  subDays,
  startOfDay,
} from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

export type QuickDatePreset = "this_week" | "last_week" | "this_month" | "last_30_days" | "custom";

interface TeamMember {
  id: string;
  name: string;
}

interface SalespersonDailyReportFiltersProps {
  teamMembers: TeamMember[];
  selectedTeamMemberId: string | null;
  onTeamMemberChange: (id: string | null) => void;
  quickDatePreset: QuickDatePreset;
  onQuickDatePresetChange: (preset: QuickDatePreset) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onClearFilters: () => void;
  onExport: () => void;
  isExporting?: boolean;
}

const quickDateOptions: { value: QuickDatePreset; label: string }[] = [
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "custom", label: "Custom" },
];

export function getDateRangeFromPreset(preset: QuickDatePreset): DateRange | undefined {
  const today = startOfDay(new Date());

  switch (preset) {
    case "this_week":
      return {
        from: startOfWeek(today, { weekStartsOn: 1 }),
        to: today,
      };
    case "last_week": {
      const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
      return {
        from: lastWeekStart,
        to: endOfWeek(lastWeekStart, { weekStartsOn: 1 }),
      };
    }
    case "this_month":
      return {
        from: startOfMonth(today),
        to: today,
      };
    case "last_30_days":
      return {
        from: subDays(today, 30),
        to: today,
      };
    default:
      return undefined;
  }
}

export function SalespersonDailyReportFilters({
  teamMembers,
  selectedTeamMemberId,
  onTeamMemberChange,
  quickDatePreset,
  onQuickDatePresetChange,
  dateRange,
  onDateRangeChange,
  onClearFilters,
  onExport,
  isExporting,
}: SalespersonDailyReportFiltersProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleQuickDateChange = (preset: QuickDatePreset) => {
    onQuickDatePresetChange(preset);

    if (preset !== "custom") {
      const newRange = getDateRangeFromPreset(preset);
      onDateRangeChange(newRange);
    }
  };

  const hasActiveFilters = selectedTeamMemberId !== null || quickDatePreset !== "this_week";

  return (
    <div className="space-y-4">
      {/* Quick date preset buttons */}
      <div className="flex flex-wrap gap-2">
        {quickDateOptions.map((option) => (
          <Button
            key={option.value}
            variant={quickDatePreset === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleQuickDateChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Team member dropdown and date range picker */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Team Member Dropdown */}
        <Select
          value={selectedTeamMemberId || "all"}
          onValueChange={(v) => onTeamMemberChange(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Team Members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Team Members</SelectItem>
            {teamMembers.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range Picker (when custom selected) */}
        {quickDatePreset === "custom" && (
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM d, yyyy")
                  )
                ) : (
                  "Select date range"
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
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        )}

        {/* Show current date range when not custom */}
        {quickDatePreset !== "custom" && dateRange?.from && dateRange?.to && (
          <span className="text-sm text-muted-foreground">
            {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
          </span>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={onClearFilters} title="Clear filters">
            <X className="h-4 w-4" />
          </Button>
        )}

        {/* Export Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={isExporting}
          className="ml-auto"
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>
    </div>
  );
}
