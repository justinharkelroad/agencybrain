import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { CalendarDays, BarChart3, RotateCcw } from 'lucide-react';
import { format, addDays, startOfDay, parseISO, getDay } from 'date-fns';

interface RenewalsDashboardProps {
  chartRecords: { renewal_effective_date: string | null }[];
  onDateFilter: (date: string | null) => void;
  onDayOfWeekFilter: (dayIndex: number | null) => void;
  activeDateFilter: string | null;
  activeDayFilter: number | null;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function RenewalsDashboard({ chartRecords, onDateFilter, onDayOfWeekFilter, activeDateFilter, activeDayFilter }: RenewalsDashboardProps) {
  // Calculate data for the past 6 days + today (7 days total)
  const upcomingData = useMemo(() => {
    const today = startOfDay(new Date());
    const days: { date: string; dateLabel: string; count: number; dayName: string; isWeekend: boolean }[] = [];
    
    // Start 6 days ago, go through today (7 days total)
    for (let i = -6; i <= 0; i++) {
      const date = addDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayOfWeek = getDay(date);
      
      const count = chartRecords.filter(r => {
        if (!r.renewal_effective_date) return false;
        const recordDate = format(parseISO(r.renewal_effective_date), 'yyyy-MM-dd');
        return recordDate === dateStr;
      }).length;
      
      days.push({
        date: dateStr,
        dateLabel: format(date, 'MMM d'),
        dayName: DAY_NAMES[dayOfWeek],
        count,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6
      });
    }
    
    return days;
  }, [chartRecords]);

  // Calculate average
  const averageCount = useMemo(() => {
    const total = upcomingData.reduce((sum, d) => sum + d.count, 0);
    return total / upcomingData.length;
  }, [upcomingData]);

  // Calculate data by day of week - same 7-day window as line chart
  // Each day appears exactly once, so this is just a reorganized view of the same data
  const dayOfWeekData = useMemo(() => {
    const today = startOfDay(new Date());
    const dayData: { day: string; dayIndex: number; count: number }[] = [];
    
    // Build data for each of the 7 days
    for (let i = -6; i <= 0; i++) {
      const date = addDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayOfWeek = getDay(date);
      
      const count = chartRecords.filter(r => {
        if (!r.renewal_effective_date) return false;
        const recordDate = format(parseISO(r.renewal_effective_date), 'yyyy-MM-dd');
        return recordDate === dateStr;
      }).length;
      
      dayData.push({
        day: DAY_NAMES[dayOfWeek],
        dayIndex: dayOfWeek,
        count
      });
    }
    
    // Sort by day of week starting with Monday
    const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
    return dayData.sort((a, b) => dayOrder.indexOf(a.dayIndex) - dayOrder.indexOf(b.dayIndex));
  }, [chartRecords]);

  const maxDayCount = Math.max(...dayOfWeekData.map(d => d.count), 1);

  // Custom tooltip for area chart
  const AreaTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 text-white px-3 py-2 rounded shadow-lg text-sm">
          <p className="font-medium">{payload[0].payload.dateLabel}</p>
          <p>{payload[0].value} renewals</p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for bar chart
  const BarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 text-white px-3 py-2 rounded shadow-lg text-sm">
          <p className="font-medium">{DAY_NAMES_FULL[payload[0].payload.dayIndex]}</p>
          <p>{payload[0].value} renewals</p>
        </div>
      );
    }
    return null;
  };

  const hasActiveFilter = activeDateFilter !== null || activeDayFilter !== null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
      {/* Upcoming Renewals - Area Chart */}
      <Card className="bg-[#1a1f2e] border-gray-700 lg:col-span-3">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-400" />
              <CardTitle className="text-lg text-white">Upcoming Renewals</CardTitle>
            </div>
            <span className="text-xs text-gray-400">Last 7 days</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={upcomingData}
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                onClick={(data) => {
                  if (data && data.activePayload) {
                    const clickedDate = data.activePayload[0].payload.date;
                    onDateFilter(activeDateFilter === clickedDate ? null : clickedDate);
                    onDayOfWeekFilter(null); // Clear other filter
                  }
                }}
              >
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#9ca3af"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<AreaTooltip />} />
                <ReferenceLine
                  y={averageCount}
                  stroke="#22c55e"
                  strokeDasharray="5 5"
                  label={{ value: `Avg: ${averageCount.toFixed(1)}/day`, position: 'right', fill: '#22c55e', fontSize: 11 }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#colorCount)"
                  dot={({ cx, cy, payload }) => {
                    const isActive = activeDateFilter === payload.date;
                    const isBelowAvg = payload.count < averageCount;
                    return (
                      <circle
                        key={payload.date}
                        cx={cx}
                        cy={cy}
                        r={isActive ? 8 : 6}
                        fill={isActive ? '#fbbf24' : isBelowAvg ? '#ef4444' : '#3b82f6'}
                        stroke={isActive ? '#fbbf24' : isBelowAvg ? '#ef4444' : '#3b82f6'}
                        strokeWidth={2}
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  }}
                  activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Click a point to filter by that date • <span className="text-red-400">Red</span> = below average
          </p>
        </CardContent>
      </Card>

      {/* Day of Week Distribution - Horizontal Bar Chart */}
      <Card className="bg-[#1a1f2e] border-gray-700 lg:col-span-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              <CardTitle className="text-base text-white">By Day</CardTitle>
            </div>
            {hasActiveFilter && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs text-gray-400 hover:text-white"
                onClick={() => {
                  onDateFilter(null);
                  onDayOfWeekFilter(null);
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dayOfWeekData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                onClick={(data) => {
                  if (data && data.activePayload) {
                    const clickedDayIndex = data.activePayload[0].payload.dayIndex;
                    onDayOfWeekFilter(activeDayFilter === clickedDayIndex ? null : clickedDayIndex);
                    onDateFilter(null);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis 
                  type="number" 
                  stroke="#9ca3af" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis 
                  type="category" 
                  dataKey="day" 
                  stroke="#9ca3af" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                <Bar 
                  dataKey="count" 
                  radius={[0, 4, 4, 0]}
                  style={{ cursor: 'pointer' }}
                >
                  {dayOfWeekData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={activeDayFilter === entry.dayIndex ? '#fbbf24' : '#3b82f6'}
                      fillOpacity={activeDayFilter === null || activeDayFilter === entry.dayIndex ? 1 : 0.3}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Click a bar to filter by day of week
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
