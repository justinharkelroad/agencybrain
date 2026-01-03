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

interface SalesByPolicyTypeChartProps {
  agencyId: string | null;
  startDate: string;
  endDate: string;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function SalesByPolicyTypeChart({ agencyId, startDate, endDate }: SalesByPolicyTypeChartProps) {
  const [metric, setMetric] = useState<MetricType>("items");

  const { data, isLoading } = useQuery({
    queryKey: ["sales-by-policy-type", agencyId, startDate, endDate],
    queryFn: async () => {
      if (!agencyId) return [];

      // Get sale_items joined with product_types and sales
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("id")
        .eq("agency_id", agencyId)
        .gte("sale_date", startDate)
        .lte("sale_date", endDate);

      if (salesError) throw salesError;
      const saleIds = (salesData || []).map((s) => s.id);
      if (saleIds.length === 0) return [];

      // Get sale_policies for these sales
      const { data: policies, error: policiesError } = await supabase
        .from("sale_policies")
        .select("id")
        .in("sale_id", saleIds);

      if (policiesError) throw policiesError;
      const policyIds = (policies || []).map((p) => p.id);
      if (policyIds.length === 0) return [];

      // Get sale_items with product type info
      const { data: items, error: itemsError } = await supabase
        .from("sale_items")
        .select(`
          item_count,
          premium,
          points,
          product_type_id,
          product_type_name
        `)
        .in("sale_policy_id", policyIds);

      if (itemsError) throw itemsError;

      // Get product types for proper names
      const { data: productTypes } = await supabase
        .from("product_types")
        .select("id, name")
        .eq("agency_id", agencyId);

      const ptMap = new Map((productTypes || []).map((pt) => [pt.id, pt.name]));

      // Group by product type
      const grouped: Record<string, { policy_type: string; items: number; premium: number; points: number }> = {};
      
      for (const item of items || []) {
        const typeName = item.product_type_id 
          ? (ptMap.get(item.product_type_id) || item.product_type_name || "Unknown")
          : (item.product_type_name || "Unknown");
        
        if (!grouped[typeName]) {
          grouped[typeName] = { policy_type: typeName, items: 0, premium: 0, points: 0 };
        }
        grouped[typeName].items += item.item_count || 0;
        grouped[typeName].premium += item.premium || 0;
        grouped[typeName].points += item.points || 0;
      }

      const result = Object.values(grouped).sort((a, b) => b.items - a.items);
      return result;
    },
    enabled: !!agencyId,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  }, [data]);

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
        <CardTitle className="text-base font-medium">Sales by Policy Type</CardTitle>
        <MetricToggle 
          value={metric} 
          onChange={setMetric} 
          availableMetrics={["items", "premium", "points"]}
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
                dataKey="policy_type"
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
