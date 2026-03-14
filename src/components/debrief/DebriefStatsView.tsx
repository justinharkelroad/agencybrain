import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Heart, Sparkles, Target, Trophy } from "lucide-react";
import type { DebriefStatsData, CategoryStats, DailyBreakdown } from "@/hooks/useDebriefStats";
import { Loader2 } from "lucide-react";

interface DebriefStatsViewProps {
  stats: DebriefStatsData;
}

function DeltaBadge({ delta, suffix = "" }: { delta: number; suffix?: string }) {
  if (delta === 0) return <span className="text-muted-foreground/50 text-xs"><Minus className="h-3 w-3 inline" /></span>;
  const isUp = delta > 0;
  return (
    <span className={cn("text-xs font-semibold inline-flex items-center gap-0.5", isUp ? "text-emerald-400" : "text-red-400")}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? "+" : ""}{delta}{suffix}
    </span>
  );
}

function ScoreHeaderItem({ label, icon: Icon, stat, color }: {
  label: string;
  icon: React.ElementType;
  stat: CategoryStats;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("h-4 w-4", color)} />
      <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold text-foreground">{stat.current}</span>
      <span className="text-xs text-muted-foreground/70">/ {stat.max}</span>
      <DeltaBadge delta={stat.delta} />
    </div>
  );
}

function CompareCard({ value, label, highlighted }: { value: number; label: string; highlighted?: boolean }) {
  return (
    <div className={cn(
      "flex flex-col items-center gap-1 px-4 py-3 rounded-xl",
      highlighted ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-foreground/5 border border-border"
    )}>
      <span className={cn(
        "text-xl font-bold",
        highlighted ? "text-emerald-400" : "text-foreground"
      )}>{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

function CategoryDonut({ stats }: { stats: DebriefStatsData }) {
  const categories = [
    { key: "core4", label: "Core 4", stat: stats.core4, color: "#60a5fa" },
    { key: "flow", label: "Flow", stat: stats.flow, color: "#a78bfa" },
    { key: "playbook", label: "Playbook", stat: stats.playbook, color: "#f472b6" },
  ];

  const totalPct = stats.total.pct;

  // SVG donut with multiple arcs
  const radius = 60;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const gap = 4; // gap between arcs in degrees

  return (
    <div className="bg-foreground/5 rounded-xl p-5 border border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Average Scores</p>

      <div className="space-y-3 mb-6">
        {categories.map(({ label, stat, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-sm text-muted-foreground flex-1">{label}</span>
            <span className="text-sm font-semibold text-foreground">{stat.pct}%</span>
            <DeltaBadge delta={stat.deltaPct} suffix="%" />
          </div>
        ))}
      </div>

      {/* Simple donut */}
      <div className="flex justify-center">
        <div className="relative w-36 h-36">
          <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
            {/* Background */}
            <circle cx="70" cy="70" r={radius} fill="none" className="stroke-foreground/5" strokeWidth={strokeWidth} />
            {/* Core 4 arc */}
            <circle
              cx="70" cy="70" r={radius}
              fill="none"
              stroke="#60a5fa"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${(stats.core4.pct / 100) * circumference * 0.5} ${circumference}`}
            />
            {/* Flow arc */}
            <circle
              cx="70" cy="70" r={radius - strokeWidth - 2}
              fill="none"
              stroke="#a78bfa"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${(stats.flow.pct / 100) * circumference * 0.42} ${circumference}`}
            />
            {/* Playbook arc */}
            <circle
              cx="70" cy="70" r={radius - (strokeWidth + 2) * 2}
              fill="none"
              stroke="#f472b6"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${(stats.playbook.pct / 100) * circumference * 0.34} ${circumference}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">{totalPct}%</span>
            <DeltaBadge delta={stats.total.deltaPct} suffix="%" />
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekdayChart({ dailyBreakdown }: { dailyBreakdown: DailyBreakdown[] }) {
  const chartData = dailyBreakdown.map((d) => ({
    day: d.dayLabel,
    "Core 4": d.core4,
    Flow: d.flow,
    Playbook: d.playbook,
    total: d.core4 + d.flow + d.playbook,
  }));

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-xl">
        <p className="text-xs font-semibold text-popover-foreground mb-2">{label}</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="text-popover-foreground font-semibold ml-auto">{entry.value}</span>
          </div>
        ))}
        <div className="border-t border-border/50 mt-2 pt-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total</span>
          <span className="text-popover-foreground font-bold">{payload.reduce((s, p) => s + p.value, 0)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-foreground/5 rounded-xl p-5 border border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Scores by Day</p>

      <div className="flex gap-4 mb-3 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#60a5fa]" />
          <span className="text-muted-foreground">Core 4</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#a78bfa]" />
          <span className="text-muted-foreground">Flow</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#f472b6]" />
          <span className="text-muted-foreground">Playbook</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} barGap={2}>
          <XAxis
            dataKey="day"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground) / 0.7)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={[0, 9]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--foreground) / 0.05)" }} />
          <Bar dataKey="Core 4" stackId="a" fill="#60a5fa" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Flow" stackId="a" fill="#a78bfa" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Playbook" stackId="a" fill="#f472b6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DebriefStatsView({ stats }: DebriefStatsViewProps) {
  if (stats.loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Score header bar */}
      <div className="flex flex-wrap gap-4 justify-center bg-foreground/5 rounded-xl p-4 border border-border">
        <ScoreHeaderItem label="Total" icon={Trophy} stat={stats.total} color="text-amber-400" />
        <div className="w-px bg-border hidden sm:block" />
        <ScoreHeaderItem label="Core 4" icon={Heart} stat={stats.core4} color="text-blue-400" />
        <div className="w-px bg-border hidden sm:block" />
        <ScoreHeaderItem label="Flow" icon={Sparkles} stat={stats.flow} color="text-purple-400" />
        <div className="w-px bg-border hidden sm:block" />
        <ScoreHeaderItem label="Playbook" icon={Target} stat={stats.playbook} color="text-pink-400" />
      </div>

      {/* Compare To row */}
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider text-center">Compare To</p>
        <div className="grid grid-cols-4 gap-2">
          <CompareCard value={stats.previousWeek} label="Previous Week" />
          <CompareCard value={stats.fourWeekAvg} label="4 Week Avg" />
          <CompareCard value={stats.yearAvg} label="Year Avg" highlighted />
          <CompareCard value={stats.overallAvg} label="Overall Avg" />
        </div>
      </div>

      {/* Two-column: Donut + Bar chart */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        <CategoryDonut stats={stats} />
        {stats.dailyBreakdown.length > 0 && (
          <WeekdayChart dailyBreakdown={stats.dailyBreakdown} />
        )}
      </div>
    </div>
  );
}
