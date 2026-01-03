import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricToggle, MetricType } from "./MetricToggle";
import { useState } from "react";
import { Loader2 } from "lucide-react";
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
}

const BUNDLE_COLORS: Record<string, string> = {
  Preferred: "hsl(var(--chart-1))",
  Standard: "hsl(var(--chart-2))",
  Monoline: "hsl(var(--chart-3))",
};

const BUNDLE_ORDER = ["Preferred", "Standard", "Monoline"];

interface BundleRow {
  bundle_type: string;
  items: number;
  premium: number;
  households: number;
}

export function SalesByBundleChart({ agencyId, startDate, endDate, staffSessionToken }: SalesByBundleChartProps) {
  const [metric, setMetric] = useState<MetricType>("items");

  const { data, isLoading } = useQuery({
    queryKey: ["sales-by-bundle", agencyId, startDate, endDate, staffSessionToken],
    queryFn: async () => {
      if (!agencyId) return [];

      // If staff session, use edge function
      if (staffSessionToken) {
        const { data: result, error } = await supabase.functions.invoke('get_staff_sales_analytics', {
          headers: { 'x-staff-session': staffSessionToken },
          body: { type: 'by-bundle', start_date: startDate, end_date: endDate }
        });
        if (error) throw error;
        if (result?.error) throw new Error(result.error);
        return (result?.data || []) as BundleRow[];
      }

      // Admin path - direct query
      const { data: sales, error } = await supabase
        .from("sales")
        .select("bundle_type, total_items, total_premium, customer_name")
        .eq("agency_id", agencyId)
        .gte("sale_date", startDate)
        .lte("sale_date", endDate);

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
        acc[bundleType].items += sale.total_items || 0;
        acc[bundleType].premium += sale.total_premium || 0;
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-medium">Sales by Bundle Type</CardTitle>
        <MetricToggle 
          value={metric} 
          onChange={setMetric} 
          availableMetrics={["items", "premium", "households"]}
        />
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No sales data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="bundle_type"
                className="text-muted-foreground"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                className="text-muted-foreground"
                tick={{ fontSize: 11 }}
                tickFormatter={metric === "premium" ? (v) => `$${v}` : undefined}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value: number) => [formatValue(value), metric.charAt(0).toUpperCase() + metric.slice(1)]}
              />
              <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.bundle_type} fill={BUNDLE_COLORS[entry.bundle_type] || "hsl(var(--primary))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
