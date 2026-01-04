import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricToggle, MetricType } from "./MetricToggle";
import { DrillDownTable } from "./DrillDownTable";
import { BarChart3, Loader2, X } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

interface SalesBySourceChartProps {
  agencyId: string | null;
  startDate: string;
  endDate: string;
  staffSessionToken?: string;
  canEditAllSales?: boolean;
  currentTeamMemberId?: string;
  leadSources?: { id: string; name: string }[];
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

interface SourceRow {
  lead_source: string;
  items: number;
  premium: number;
  policies: number;
  households: number;
}

const RankBadge = (props: any) => {
  const { x, y, width, height, index } = props;
  if (width < 20) return null;
  
  return (
    <g>
      <circle 
        cx={x + width + 18} 
        cy={y + (height / 2)} 
        r={12} 
        fill="#10b981"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
      />
      <text 
        x={x + width + 18} 
        y={y + (height / 2)} 
        textAnchor="middle" 
        dominantBaseline="middle" 
        fill="white" 
        fontSize={11} 
        fontWeight="bold"
      >
        {index + 1}
      </text>
    </g>
  );
};

const PAGE_SIZE = 10;

export function SalesBySourceChart({ agencyId, startDate, endDate, staffSessionToken, canEditAllSales, currentTeamMemberId, leadSources = [] }: SalesBySourceChartProps) {
  const [metric, setMetric] = useState<MetricType>("items");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [drillPage, setDrillPage] = useState(1);

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

  const handleBarClick = (data: any) => {
    const clickedSource = data?.lead_source;
    if (!clickedSource) return;
    
    if (selectedSource === clickedSource) {
      setSelectedSource(null);
    } else {
      setSelectedSource(clickedSource);
      setDrillPage(1);
    }
  };

  const handleClearSelection = () => {
    setSelectedSource(null);
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
          <CardTitle className="text-lg font-semibold">Sales by Lead Source</CardTitle>
          {selectedSource && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={handleClearSelection}>
              {selectedSource}
              <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
        <MetricToggle 
          value={metric} 
          onChange={setMetric} 
          availableMetrics={["items", "premium", "policies", "households"]}
        />
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
            <p>No sales data for this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 50)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 50, left: 100, bottom: 5 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                horizontal={false} 
              />
              <XAxis
                type="number"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={metric === "premium" ? (v) => `$${v}` : undefined}
              />
              <YAxis
                type="category"
                dataKey="lead_source"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 13 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                width={95}
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
                radius={[8, 8, 8, 8]}
                onClick={handleBarClick}
                cursor="pointer"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={selectedSource === entry.lead_source ? '#3b82f6' : CHART_COLORS[index % CHART_COLORS.length]}
                    stroke={selectedSource === entry.lead_source ? '#ffffff' : 'none'}
                    strokeWidth={selectedSource === entry.lead_source ? 2 : 0}
                  />
                ))}
                <LabelList content={<RankBadge />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {selectedSource && agencyId && (
          <DrillDownTable
            filter={{
              type: 'lead_source',
              value: selectedSource,
              displayLabel: selectedSource,
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
