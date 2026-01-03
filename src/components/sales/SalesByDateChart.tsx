import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricToggle, MetricType } from "./MetricToggle";
import { DrillDownTable } from "./DrillDownTable";
import { BarChart3, Loader2, X } from "lucide-react";
import { formatDateLocal } from "@/lib/utils";
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

interface SalesByDateChartProps {
  agencyId: string | null;
  startDate: string;
  endDate: string;
  staffSessionToken?: string;
}

interface SalesByDateRow {
  sale_date: string;
  items: number;
  premium: number;
  points: number;
  policies: number;
  households: number;
}

const CHART_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue  
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

const PAGE_SIZE = 10;

export function SalesByDateChart({ agencyId, startDate, endDate, staffSessionToken }: SalesByDateChartProps) {
  const [metric, setMetric] = useState<MetricType>("items");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [drillPage, setDrillPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["sales-by-date", agencyId, startDate, endDate, staffSessionToken],
    queryFn: async () => {
      if (!agencyId) return [];

      // If staff session, use edge function
      if (staffSessionToken) {
        const { data: result, error } = await supabase.functions.invoke('get_staff_sales_analytics', {
          headers: { 'x-staff-session': staffSessionToken },
          body: { type: 'by-date', start_date: startDate, end_date: endDate }
        });
        if (error) throw error;
        if (result?.error) throw new Error(result.error);
        return (result?.data || []) as SalesByDateRow[];
      }

      // Admin path - direct query
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
      dateLabel: formatDateLocal(row.sale_date, "MMM d"),
    }));
  }, [data]);

  const formatValue = (value: number) => {
    if (metric === "premium") {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  const handleBarClick = (data: any) => {
    const clickedDate = data?.sale_date;
    if (!clickedDate) return;
    
    if (selectedDate === clickedDate) {
      setSelectedDate(null);
    } else {
      setSelectedDate(clickedDate);
      setDrillPage(1);
    }
  };

  const handleClearSelection = () => {
    setSelectedDate(null);
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

  const selectedDateLabel = selectedDate ? formatDateLocal(selectedDate) : "";

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold">Sales by Date</CardTitle>
          {selectedDate && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={handleClearSelection}>
              {selectedDateLabel}
              <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
        <MetricToggle value={metric} onChange={setMetric} />
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
            <p>No sales data for this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false}
              />
              <XAxis
                dataKey="dateLabel"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
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
                radius={[4, 4, 0, 0]}
                onClick={handleBarClick}
                cursor="pointer"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={selectedDate === entry.sale_date ? '#3b82f6' : CHART_COLORS[index % CHART_COLORS.length]}
                    stroke={selectedDate === entry.sale_date ? '#ffffff' : 'none'}
                    strokeWidth={selectedDate === entry.sale_date ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {selectedDate && agencyId && (
          <DrillDownTable
            filter={{
              type: 'date',
              value: selectedDate,
              displayLabel: selectedDateLabel,
            }}
            agencyId={agencyId}
            startDate={startDate}
            endDate={endDate}
            page={drillPage}
            pageSize={PAGE_SIZE}
            onPageChange={setDrillPage}
            onClear={handleClearSelection}
            staffSessionToken={staffSessionToken}
          />
        )}
      </CardContent>
    </Card>
  );
}
