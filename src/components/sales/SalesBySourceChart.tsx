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

interface SalesBySourceChartProps {
  agencyId: string | null;
  startDate: string;
  endDate: string;
  staffSessionToken?: string;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface SourceRow {
  lead_source: string;
  items: number;
  premium: number;
  policies: number;
  households: number;
}

export function SalesBySourceChart({ agencyId, startDate, endDate, staffSessionToken }: SalesBySourceChartProps) {
  const [metric, setMetric] = useState<MetricType>("items");

  const { data, isLoading } = useQuery({
    queryKey: ["sales-by-source", agencyId, startDate, endDate, staffSessionToken],
    queryFn: async () => {
      if (!agencyId) return [];

      // If staff session, use edge function
      if (staffSessionToken) {
        const { data: result, error } = await supabase.functions.invoke('get_staff_sales_analytics', {
          headers: { 'x-staff-session': staffSessionToken },
          body: { type: 'by-source', start_date: startDate, end_date: endDate }
        });
        if (error) throw error;
        if (result?.error) throw new Error(result.error);
        return (result?.data || []) as SourceRow[];
      }

      // Admin path - direct query
      const { data: sales, error } = await supabase
        .from("sales")
        .select(`
          id,
          total_items,
          total_premium,
          customer_name,
          lead_source_id
        `)
        .eq("agency_id", agencyId)
        .gte("sale_date", startDate)
        .lte("sale_date", endDate);

      if (error) throw error;

      const { data: leadSources } = await supabase
        .from("lead_sources")
        .select("id, name")
        .eq("agency_id", agencyId);

      const sourceMap = new Map<string, string>();
      for (const ls of leadSources || []) {
        sourceMap.set(ls.id, ls.name);
      }

      const grouped: Record<string, { lead_source: string; items: number; premium: number; policies: number; households: Set<string> }> = {};
      
      for (const sale of sales || []) {
        const sourceId = sale.lead_source_id ? String(sale.lead_source_id) : null;
        const sourceName: string = sourceId 
          ? (sourceMap.get(sourceId) || "Unknown")
          : "Not Set";
        
        if (!grouped[sourceName]) {
          grouped[sourceName] = {
            lead_source: sourceName,
            items: 0,
            premium: 0,
            policies: 0,
            households: new Set<string>(),
          };
        }
        grouped[sourceName].items += sale.total_items || 0;
        grouped[sourceName].premium += sale.total_premium || 0;
        grouped[sourceName].policies += 1;
        if (sale.customer_name) {
          grouped[sourceName].households.add(sale.customer_name.toLowerCase().trim());
        }
      }

      return Object.values(grouped)
        .map((row) => ({
          lead_source: row.lead_source,
          items: row.items,
          premium: row.premium,
          policies: row.policies,
          households: row.households.size,
        }))
        .sort((a, b) => b.items - a.items) as SourceRow[];
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
        <CardTitle className="text-base font-medium">Sales by Lead Source</CardTitle>
        <MetricToggle 
          value={metric} 
          onChange={setMetric} 
          availableMetrics={["items", "premium", "policies", "households"]}
        />
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No sales data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 50)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis
                type="number"
                className="text-muted-foreground"
                tick={{ fontSize: 11 }}
                tickFormatter={metric === "premium" ? (v) => `$${v}` : undefined}
              />
              <YAxis
                type="category"
                dataKey="lead_source"
                className="text-muted-foreground"
                tick={{ fontSize: 12 }}
                width={95}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value: number) => [formatValue(value), metric.charAt(0).toUpperCase() + metric.slice(1)]}
              />
              <Bar dataKey={metric} radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
