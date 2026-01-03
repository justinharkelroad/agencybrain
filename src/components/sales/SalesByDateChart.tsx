import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricToggle, MetricType } from "./MetricToggle";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SalesByDateChartProps {
  agencyId: string | null;
  startDate: string;
  endDate: string;
}

interface SalesByDateRow {
  sale_date: string;
  items: number;
  premium: number;
  points: number;
  policies: number;
  households: number;
}

export function SalesByDateChart({ agencyId, startDate, endDate }: SalesByDateChartProps) {
  const [metric, setMetric] = useState<MetricType>("items");

  const { data, isLoading } = useQuery({
    queryKey: ["sales-by-date", agencyId, startDate, endDate],
    queryFn: async () => {
      if (!agencyId) return [];

      const { data, error } = await supabase
        .from("sales")
        .select("sale_date, total_items, total_premium, total_points, customer_name")
        .eq("agency_id", agencyId)
        .gte("sale_date", startDate)
        .lte("sale_date", endDate)
        .order("sale_date");

      if (error) throw error;

      // Group by date
      const grouped: Record<string, { sale_date: string; items: number; premium: number; points: number; policies: number; households: Set<string> }> = {};
      
      for (const sale of data || []) {
        const date = sale.sale_date;
        if (!grouped[date]) {
          grouped[date] = {
            sale_date: date,
            items: 0,
            premium: 0,
            points: 0,
            policies: 0,
            households: new Set<string>(),
          };
        }
        grouped[date].items += sale.total_items || 0;
        grouped[date].premium += sale.total_premium || 0;
        grouped[date].points += sale.total_points || 0;
        grouped[date].policies += 1;
        if (sale.customer_name) {
          grouped[date].households.add(sale.customer_name.toLowerCase().trim());
        }
      }

      return Object.values(grouped).map((row) => ({
        sale_date: row.sale_date,
        items: row.items,
        premium: row.premium,
        points: row.points,
        policies: row.policies,
        households: row.households.size,
      })) as SalesByDateRow[];
    },
    enabled: !!agencyId,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((row) => ({
      ...row,
      dateLabel: format(parseISO(row.sale_date), "MMM d"),
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
        <CardTitle className="text-base font-medium">Sales by Date</CardTitle>
        <MetricToggle value={metric} onChange={setMetric} />
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No sales data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="dateLabel"
                className="text-muted-foreground"
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                className="text-muted-foreground"
                tick={{ fontSize: 11 }}
                tickLine={false}
                tickFormatter={metric === "premium" ? (v) => `$${v}` : undefined}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number) => [formatValue(value), metric.charAt(0).toUpperCase() + metric.slice(1)]}
              />
              <Bar
                dataKey={metric}
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
