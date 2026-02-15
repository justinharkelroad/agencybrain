import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricToggle, MetricType } from "./MetricToggle";
import { DrillDownTable } from "./DrillDownTable";
import { BarChart3, Loader2, X } from "lucide-react";
import { isExcludedProduct } from "@/lib/product-constants";
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

interface SalesByPolicyTypeChartProps {
  agencyId: string | null;
  startDate: string;
  endDate: string;
  staffSessionToken?: string;
  canEditAllSales?: boolean;
  currentTeamMemberId?: string;
  leadSources?: { id: string; name: string }[];
  businessFilter?: string;
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

interface PolicyTypeRow {
  policy_type: string;
  items: number;
  premium: number;
  points: number;
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

export function SalesByPolicyTypeChart({ agencyId, startDate, endDate, staffSessionToken, canEditAllSales, currentTeamMemberId, leadSources = [], businessFilter = "all" }: SalesByPolicyTypeChartProps) {
  const [metric, setMetric] = useState<MetricType>("items");
  const [selectedPolicyType, setSelectedPolicyType] = useState<string | null>(null);
  const [drillPage, setDrillPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["sales-by-policy-type", agencyId, startDate, endDate, staffSessionToken, businessFilter],
    queryFn: async () => {
      if (!agencyId) return [];

      // If staff session, use edge function
      if (staffSessionToken) {
        const { data: result, error } = await supabase.functions.invoke('get_staff_sales_analytics', {
          headers: { 'x-staff-session': staffSessionToken },
          body: { type: 'by-policy-type', start_date: startDate, end_date: endDate, business_filter: businessFilter }
        });
        if (error) throw error;
        if (result?.error) throw new Error(result.error);
        return (result?.data || []) as PolicyTypeRow[];
      }

      // Admin path - direct query
      let salesQuery = supabase
        .from("sales")
        .select("id")
        .eq("agency_id", agencyId)
        .gte("sale_date", startDate)
        .lte("sale_date", endDate);

      // Apply business filter
      if (businessFilter === "regular") {
        salesQuery = salesQuery.is("brokered_carrier_id", null);
      } else if (businessFilter === "brokered") {
        salesQuery = salesQuery.not("brokered_carrier_id", "is", null);
      }

      const { data: salesData, error: salesError } = await salesQuery;

      if (salesError) throw salesError;
      const saleIds = (salesData || []).map((s) => s.id);
      if (saleIds.length === 0) return [];

      const { data: policies, error: policiesError } = await supabase
        .from("sale_policies")
        .select("id")
        .in("sale_id", saleIds);

      if (policiesError) throw policiesError;
      const policyIds = (policies || []).map((p) => p.id);
      if (policyIds.length === 0) return [];

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

      const { data: productTypes } = await supabase
        .from("product_types")
        .select("id, name")
        .eq("agency_id", agencyId);

      const ptMap = new Map((productTypes || []).map((pt) => [pt.id, pt.name]));

      const grouped: Record<string, { policy_type: string; items: number; premium: number; points: number }> = {};
      
      for (const item of items || []) {
        const typeName = item.product_type_id 
          ? (ptMap.get(item.product_type_id) || item.product_type_name || "Unknown")
          : (item.product_type_name || "Unknown");
        
        // Skip excluded products (e.g., Motor Club)
        if (isExcludedProduct(typeName)) continue;
        
        if (!grouped[typeName]) {
          grouped[typeName] = { policy_type: typeName, items: 0, premium: 0, points: 0 };
        }
        grouped[typeName].items += item.item_count || 0;
        grouped[typeName].premium += item.premium || 0;
        grouped[typeName].points += item.points || 0;
      }

      return Object.values(grouped).sort((a, b) => b.items - a.items) as PolicyTypeRow[];
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

  const handleBarClick = (data: any) => {
    const clickedType = data?.policy_type;
    if (!clickedType) return;
    
    if (selectedPolicyType === clickedType) {
      setSelectedPolicyType(null);
    } else {
      setSelectedPolicyType(clickedType);
      setDrillPage(1);
    }
  };

  const handleClearSelection = () => {
    setSelectedPolicyType(null);
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
          <CardTitle className="text-lg font-semibold">Sales by Policy Type</CardTitle>
          {selectedPolicyType && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={handleClearSelection}>
              {selectedPolicyType}
              <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
        <MetricToggle 
          value={metric} 
          onChange={setMetric} 
          availableMetrics={["items", "premium", "points"]}
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
              barCategoryGap="40%"
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
                dataKey="policy_type"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 13 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                width={95}
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
                radius={[0, 8, 8, 0]}
                maxBarSize={16}
                onClick={handleBarClick}
                cursor="pointer"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={selectedPolicyType === entry.policy_type ? '#3b82f6' : CHART_COLORS[index % CHART_COLORS.length]}
                    stroke={selectedPolicyType === entry.policy_type ? '#ffffff' : 'none'}
                    strokeWidth={selectedPolicyType === entry.policy_type ? 2 : 0}
                  />
                ))}
                <LabelList content={<RankBadge />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {selectedPolicyType && agencyId && (
          <DrillDownTable
            filter={{
              type: 'policy_type',
              value: selectedPolicyType,
              displayLabel: selectedPolicyType,
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
