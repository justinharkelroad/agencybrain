import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricToggle, MetricType } from "./MetricToggle";
import { DrillDownTable } from "./DrillDownTable";
import { BarChart3, Loader2, X } from "lucide-react";
import { calculateCountableTotals } from "@/lib/product-constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface SalesByBundleChartProps {
  agencyId: string | null;
  startDate: string;
  endDate: string;
  staffSessionToken?: string;
  canEditAllSales?: boolean;
  currentTeamMemberId?: string;
  leadSources?: { id: string; name: string }[];
  businessFilter?: string;
}

const BUNDLE_COLORS: Record<string, string> = {
  Preferred: "#22c55e",  // green
  Standard: "#3b82f6",   // blue
  Monoline: "#f59e0b",   // amber
};

const BUNDLE_ORDER = ["Preferred", "Standard", "Monoline"];

interface BundleRow {
  bundle_type: string;
  items: number;
  premium: number;
  households: number;
}

interface SalePolicy {
  id: string;
  policy_type_name: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
}

const PAGE_SIZE = 10;

export function SalesByBundleChart({ agencyId, startDate, endDate, staffSessionToken, canEditAllSales, currentTeamMemberId, leadSources = [], businessFilter = "all" }: SalesByBundleChartProps) {
  const [metric, setMetric] = useState<MetricType>("items");
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [drillPage, setDrillPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["sales-by-bundle", agencyId, startDate, endDate, staffSessionToken, businessFilter],
    queryFn: async () => {
      if (!agencyId) return [];

      // If staff session, use edge function
      if (staffSessionToken) {
        const { data: result, error } = await supabase.functions.invoke('get_staff_sales_analytics', {
          headers: { 'x-staff-session': staffSessionToken },
          body: { type: 'by-bundle', start_date: startDate, end_date: endDate, business_filter: businessFilter }
        });
        if (error) throw error;
        if (result?.error) throw new Error(result.error);
        return (result?.data || []) as BundleRow[];
      }

      // Admin path - direct query with sale_policies for Motor Club filtering
      let query = supabase
        .from("sales")
        .select("bundle_type, customer_name, brokered_carrier_id, sale_policies(id, policy_type_name, total_premium, total_items, total_points)")
        .eq("agency_id", agencyId)
        .gte("sale_date", startDate)
        .lte("sale_date", endDate);

      // Apply business filter
      if (businessFilter === "regular") {
        query = query.is("brokered_carrier_id", null);
      } else if (businessFilter === "brokered") {
        query = query.not("brokered_carrier_id", "is", null);
      }

      const { data: sales, error } = await query;

      if (error) throw error;

      const grouped = (sales || []).reduce((acc, sale) => {
        const bundleType = sale.bundle_type || "Monoline";
        
        if (!acc[bundleType]) {
          acc[bundleType] = {
            bundle_type: bundleType,
            items: 0,
            premium: 0,
            households: new Set<string>(),
          };
        }
        
        // Calculate countable totals (excluding Motor Club)
        const policies = (sale.sale_policies || []) as SalePolicy[];
        const countable = calculateCountableTotals(policies);
        
        acc[bundleType].items += countable.items;
        acc[bundleType].premium += countable.premium;
        if (sale.customer_name) {
          acc[bundleType].households.add(sale.customer_name.toLowerCase().trim());
        }
        return acc;
      }, {} as Record<string, { bundle_type: string; items: number; premium: number; households: Set<string> }>);

      return BUNDLE_ORDER
        .filter((bt) => grouped[bt])
        .map((bt) => ({
          bundle_type: bt,
          items: grouped[bt].items,
          premium: grouped[bt].premium,
          households: grouped[bt].households.size,
        })) as BundleRow[];
    },
    enabled: !!agencyId,
  });

  const chartData = useMemo(() => data || [], [data]);

  const formatValue = (value: number) => {
    if (metric === "premium") {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  const handleBarClick = (data: any) => {
    const clickedBundle = data?.bundle_type;
    if (!clickedBundle) return;
    
    if (selectedBundle === clickedBundle) {
      setSelectedBundle(null);
    } else {
      setSelectedBundle(clickedBundle);
      setDrillPage(1);
    }
  };

  const handleClearSelection = () => {
    setSelectedBundle(null);
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold">Sales by Bundle Type</CardTitle>
          {selectedBundle && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={handleClearSelection}>
              {selectedBundle}
              <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
        <MetricToggle 
          value={metric} 
          onChange={setMetric} 
          availableMetrics={["items", "premium", "households"]}
        />
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
            <p>No sales data for this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              barCategoryGap="42%"
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false}
              />
              <XAxis
                dataKey="bundle_type"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 13 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={metric === "premium" ? (v) => `$${v}` : undefined}
              />
              <Tooltip
                cursor={false}
                contentStyle={{
                  backgroundColor: 'hsl(222 47% 11%)',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                formatter={(value: number) => [formatValue(value), metric.charAt(0).toUpperCase() + metric.slice(1)]}
              />
              <Bar
                dataKey={metric}
                radius={[8, 8, 0, 0]}
                maxBarSize={20}
                onClick={handleBarClick}
                cursor="pointer"
              >
                {chartData.map((entry) => (
                  <Cell 
                    key={entry.bundle_type} 
                    fill={selectedBundle === entry.bundle_type ? '#3b82f6' : (BUNDLE_COLORS[entry.bundle_type] || "#8b5cf6")}
                    stroke={selectedBundle === entry.bundle_type ? '#ffffff' : 'none'}
                    strokeWidth={selectedBundle === entry.bundle_type ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {selectedBundle && agencyId && (
          <DrillDownTable
            filter={{
              type: 'bundle_type',
              value: selectedBundle,
              displayLabel: selectedBundle,
            }}
            agencyId={agencyId}
            startDate={startDate}
            endDate={endDate}
            page={drillPage}
            pageSize={PAGE_SIZE}
            onPageChange={setDrillPage}
            onClear={handleClearSelection}
            staffSessionToken={staffSessionToken}
            canEditAllSales={canEditAllSales}
            currentTeamMemberId={currentTeamMemberId}
            leadSources={leadSources}
          />
        )}
      </CardContent>
    </Card>
  );
}
