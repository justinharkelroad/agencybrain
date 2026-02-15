import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DataRow = Record<string, string | number | null | undefined>;

interface DataKeyConfig {
  key: string;
  name: string;
  color?: string;
}

interface RosenBarChartV2Props {
  data: DataRow[];
  title: string;
  description?: string;
  dataKeys: DataKeyConfig[];
  xAxisKey: string;
  showLegend?: boolean;
  maxItems?: number;
}

const DEFAULT_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function safeLabel(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "—";
}

export function RosenBarChartV2({
  data,
  title,
  description,
  dataKeys,
  xAxisKey,
  showLegend = true,
  maxItems = 10,
}: RosenBarChartV2Props) {
  const colors = dataKeys.map(
    (keyConfig, index) => keyConfig.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
  );

  const chartData = data.slice(0, maxItems).map((row) => {
    const normalized: Record<string, string | number> = {
      [xAxisKey]: safeLabel(row[xAxisKey]),
    };

    dataKeys.forEach((key) => {
      normalized[key.key] = toNumber(row[key.key]);
    });

    return normalized;
  });

  return (
    <Card className="w-full border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 10 }}
              barCategoryGap="42%"
              barGap={6}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="8 8"
                stroke="hsl(var(--border))"
                opacity={0.5}
              />
              <XAxis
                dataKey={xAxisKey}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(value: string) =>
                  value.length > 12 ? `${value.slice(0, 11)}…` : value
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={44}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(value: number) => compactNumber(value)}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.2)" }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 10,
                }}
                formatter={(value: number, name: string) => [
                  toNumber(value).toLocaleString("en-US"),
                  name,
                ]}
              />
              {showLegend ? (
                <Legend
                  verticalAlign="top"
                  align="left"
                  wrapperStyle={{ paddingBottom: 10, fontSize: 12 }}
                  iconType="circle"
                />
              ) : null}
              {dataKeys.map((series, index) => (
                <Bar
                  key={series.key}
                  name={series.name}
                  dataKey={series.key}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={14}
                >
                  {chartData.map((row, rowIndex) => (
                    <Cell
                      key={`${series.key}-${rowIndex}`}
                      fill={colors[index]}
                      fillOpacity={toNumber(row[series.key]) === 0 ? 0.35 : 0.95}
                    />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
