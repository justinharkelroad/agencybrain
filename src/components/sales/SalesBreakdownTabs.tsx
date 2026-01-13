import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesByDateChart } from "./SalesByDateChart";
import { SalesByPolicyTypeChart } from "./SalesByPolicyTypeChart";
import { SalesBySourceChart } from "./SalesBySourceChart";
import { SalesByBundleChart } from "./SalesByBundleChart";
import { SalesByZipcodeChart } from "./SalesByZipcodeChart";
import { SalesLeaderboard } from "./SalesLeaderboard";
import { SalesMetricSummaryCards } from "./SalesMetricSummaryCards";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { startOfMonth, endOfMonth, subMonths, startOfYear, format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSalesMonthSummary } from "@/hooks/useSalesMonthSummary";

interface SalesBreakdownTabsProps {
  agencyId: string | null;
  showLeaderboard?: boolean;
  staffSessionToken?: string;
  canEditAllSales?: boolean;
  currentTeamMemberId?: string;
  leadSources?: { id: string; name: string }[];
}

type Period = "this_month" | "last_month" | "this_year" | "last_90_days" | "custom";

function getPeriodDates(period: Period, customStart?: Date, customEnd?: Date): { start: string; end: string; label: string } {
  const now = new Date();
  
  switch (period) {
    case "this_month":
      return {
        start: format(startOfMonth(now), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
        label: format(now, "MMMM yyyy"),
      };
    case "last_month":
      const lastMonth = subMonths(now, 1);
      return {
        start: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
        end: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
        label: format(lastMonth, "MMMM yyyy"),
      };
    case "this_year":
      return {
        start: format(startOfYear(now), "yyyy-MM-dd"),
        end: format(now, "yyyy-MM-dd"),
        label: format(now, "yyyy"),
      };
    case "last_90_days":
      return {
        start: format(subMonths(now, 3), "yyyy-MM-dd"),
        end: format(now, "yyyy-MM-dd"),
        label: "Last 90 Days",
      };
    case "custom":
      if (customStart && customEnd) {
        return {
          start: format(customStart, "yyyy-MM-dd"),
          end: format(customEnd, "yyyy-MM-dd"),
          label: `${format(customStart, "MMM d")} - ${format(customEnd, "MMM d, yyyy")}`,
        };
      }
      // Default to this month if custom dates not set
      return {
        start: format(startOfMonth(now), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
        label: format(now, "MMMM yyyy"),
      };
    default:
      return {
        start: format(startOfMonth(now), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
        label: format(now, "MMMM yyyy"),
      };
  }
}

export function SalesBreakdownTabs({ agencyId, showLeaderboard = true, staffSessionToken, canEditAllSales = false, currentTeamMemberId, leadSources = [] }: SalesBreakdownTabsProps) {
  const [activeTab, setActiveTab] = useState("by-date");
  const [period, setPeriod] = useState<Period>("this_month");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  
  const { start, end, label } = getPeriodDates(period, customStartDate, customEndDate);

  // Fetch summary data for the metric cards
  const { data: summary, isLoading: summaryLoading } = useSalesMonthSummary({
    agencyId,
    startDate: start,
    endDate: end,
    staffSessionToken,
  });

  // Only show projections for "This Month" since other periods are complete
  const showProjections = period === "this_month";

  const handlePeriodChange = (value: string) => {
    setPeriod(value as Period);
    if (value !== "custom") {
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Sales Breakdown</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_90_days">Last 90 Days</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {period === "custom" && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[130px] justify-start text-left font-normal",
                      !customStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customStartDate}
                    onSelect={setCustomStartDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[130px] justify-start text-left font-normal",
                      !customEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customEndDate}
                    onSelect={setCustomEndDate}
                    disabled={(date) => customStartDate ? date < customStartDate : false}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards with Projections */}
      <SalesMetricSummaryCards
        premium={summary?.premium ?? 0}
        items={summary?.items ?? 0}
        policies={summary?.policies ?? 0}
        points={summary?.points ?? 0}
        isLoading={summaryLoading}
        showProjections={showProjections}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full max-w-4xl ${showLeaderboard ? 'grid-cols-6' : 'grid-cols-5'}`}>
          <TabsTrigger value="by-date" className="text-xs sm:text-sm">By Date</TabsTrigger>
          <TabsTrigger value="by-policy" className="text-xs sm:text-sm">By Policy</TabsTrigger>
          <TabsTrigger value="by-source" className="text-xs sm:text-sm">By Source</TabsTrigger>
          <TabsTrigger value="by-bundle" className="text-xs sm:text-sm">By Bundle</TabsTrigger>
          <TabsTrigger value="by-zipcode" className="text-xs sm:text-sm">By Zipcode</TabsTrigger>
          {showLeaderboard && (
            <TabsTrigger value="leaderboard" className="text-xs sm:text-sm">Leaderboard</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="by-date" className="mt-4">
          <SalesByDateChart agencyId={agencyId} startDate={start} endDate={end} staffSessionToken={staffSessionToken} canEditAllSales={canEditAllSales} currentTeamMemberId={currentTeamMemberId} leadSources={leadSources} />
        </TabsContent>

        <TabsContent value="by-policy" className="mt-4">
          <SalesByPolicyTypeChart agencyId={agencyId} startDate={start} endDate={end} staffSessionToken={staffSessionToken} canEditAllSales={canEditAllSales} currentTeamMemberId={currentTeamMemberId} leadSources={leadSources} />
        </TabsContent>

        <TabsContent value="by-source" className="mt-4">
          <SalesBySourceChart agencyId={agencyId} startDate={start} endDate={end} staffSessionToken={staffSessionToken} canEditAllSales={canEditAllSales} currentTeamMemberId={currentTeamMemberId} leadSources={leadSources} />
        </TabsContent>

        <TabsContent value="by-bundle" className="mt-4">
          <SalesByBundleChart agencyId={agencyId} startDate={start} endDate={end} staffSessionToken={staffSessionToken} canEditAllSales={canEditAllSales} currentTeamMemberId={currentTeamMemberId} leadSources={leadSources} />
        </TabsContent>

        <TabsContent value="by-zipcode" className="mt-4">
          <SalesByZipcodeChart agencyId={agencyId} startDate={start} endDate={end} staffSessionToken={staffSessionToken} canEditAllSales={canEditAllSales} currentTeamMemberId={currentTeamMemberId} leadSources={leadSources} />
        </TabsContent>

        {showLeaderboard && (
          <TabsContent value="leaderboard" className="mt-4">
            <SalesLeaderboard agencyId={agencyId} staffSessionToken={staffSessionToken} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
