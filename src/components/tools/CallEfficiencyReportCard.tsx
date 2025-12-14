import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Download, FileImage, Copy, Save } from "lucide-react";
import { CallEfficiencyResults, formatDuration, formatTalkTime } from "@/utils/callEfficiencyCalculator";
import { ParsedCallLog } from "@/utils/callLogParser";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { toast } from "sonner";

// Colors for export compatibility
const COLORS = {
  bgPrimary: '#0f172a',
  bgCard: '#1e293b',
  bgCardAlt: '#334155',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  green: '#22c55e',
  greenBg: 'rgba(34, 197, 94, 0.2)',
  yellow: '#eab308',
  red: '#ef4444',
  blue: '#3b82f6',
  purple: '#a855f7',
  cyan: '#06b6d4',
  borderColor: '#334155',
  gold: '#f59e0b',
  silver: '#9ca3af',
  bronze: '#cd7f32',
};

interface CallEfficiencyReportCardProps {
  results: CallEfficiencyResults;
  parsedData: ParsedCallLog;
  onClose: () => void;
}

export default function CallEfficiencyReportCard({
  results,
  parsedData,
  onClose,
}: CallEfficiencyReportCardProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  const isSingleUser = results.users.length === 1;
  const dateRangeStr = `${format(results.dateRange.start, "MMM d, yyyy")} → ${format(results.dateRange.end, "MMM d, yyyy")}`;

  // Prepare chart data for user comparison
  const userChartData = results.users.map((user, idx) => ({
    name: user.user.length > 15 ? user.user.slice(0, 15) + "..." : user.user,
    fullName: user.user,
    calls: user.callsOverThreshold,
    total: user.totalCalls,
    rank: idx + 1,
  }));

  // Prepare hourly activity data (aggregate all users)
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: i < 12 ? `${i === 0 ? 12 : i}am` : `${i === 12 ? 12 : i - 12}pm`,
    calls: results.users.reduce((sum, user) => sum + user.callsByHour[i], 0),
  })).filter((d) => d.hour >= 7 && d.hour <= 19); // Show 7am-7pm

  const handleExportPNG = async () => {
    if (!reportRef.current) return;
    try {
      const dataUrl = await toPng(reportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: COLORS.bgPrimary,
      });
      const link = document.createElement("a");
      link.download = `call-efficiency-report-${format(new Date(), "yyyy-MM-dd")}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("PNG exported successfully");
    } catch (err) {
      toast.error("Failed to export PNG");
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    try {
      const dataUrl = await toPng(reportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: COLORS.bgPrimary,
      });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => (img.onload = resolve));
      
      const pdf = new jsPDF({
        orientation: img.width > img.height ? "landscape" : "portrait",
        unit: "px",
        format: [img.width, img.height],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
      pdf.save(`call-efficiency-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF exported successfully");
    } catch (err) {
      toast.error("Failed to export PDF");
    }
  };

  const handleCopyResults = () => {
    const text = results.users
      .map((u) => `${u.user}: ${u.callsOverThreshold}/${u.totalCalls} calls over ${results.thresholdMinutes}+ min (${Math.round((u.callsOverThreshold / u.totalCalls) * 100)}%)`)
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Results copied to clipboard");
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return COLORS.gold;
    if (rank === 2) return COLORS.silver;
    if (rank === 3) return COLORS.bronze;
    return COLORS.blue;
  };

  return (
    <div className="space-y-4">
      {/* Export Buttons - Outside ref */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose}>
          ← Back to Upload
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPNG}>
            <FileImage className="h-4 w-4 mr-1" />
            PNG
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyResults}>
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
        </div>
      </div>

      {/* Report Card */}
      <div
        ref={reportRef}
        style={{ backgroundColor: COLORS.bgPrimary, color: COLORS.textPrimary }}
        className="rounded-xl p-6 space-y-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-wide" style={{ color: COLORS.textPrimary }}>
              CALL EFFICIENCY REPORT
            </h2>
            <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
              {dateRangeStr}
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-full text-sm font-medium"
            style={{ backgroundColor: COLORS.cyan + "33", color: COLORS.cyan }}
          >
            {results.thresholdMinutes}+ Minute Calls
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }} className="p-4">
            <p className="text-xs mb-1" style={{ color: COLORS.textSecondary }}>Total Calls</p>
            <p className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>
              {results.totals.totalCalls.toLocaleString()}
            </p>
          </Card>
          <Card style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }} className="p-4">
            <p className="text-xs mb-1" style={{ color: COLORS.textSecondary }}>Calls Over Threshold</p>
            <p className="text-2xl font-bold" style={{ color: COLORS.green }}>
              {results.totals.callsOverThreshold.toLocaleString()}
            </p>
            <p className="text-xs" style={{ color: COLORS.textSecondary }}>
              {Math.round((results.totals.callsOverThreshold / results.totals.totalCalls) * 100)}% of total
            </p>
          </Card>
          <Card style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }} className="p-4">
            <p className="text-xs mb-1" style={{ color: COLORS.textSecondary }}>Avg Call Duration</p>
            <p className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>
              {formatDuration(results.totals.avgDurationSeconds)}
            </p>
          </Card>
          <Card style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }} className="p-4">
            <p className="text-xs mb-1" style={{ color: COLORS.textSecondary }}>Total Talk Time</p>
            <p className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>
              {formatTalkTime(results.totals.totalTalkTimeSeconds)}
            </p>
          </Card>
        </div>

        {/* User Section */}
        {isSingleUser ? (
          // Single User Stats
          <Card style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }} className="p-5">
            <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.textPrimary }}>
              {results.users[0].user}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs" style={{ color: COLORS.textSecondary }}>Inbound Calls</p>
                <p className="text-lg font-semibold" style={{ color: COLORS.blue }}>{results.users[0].inboundCalls}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: COLORS.textSecondary }}>Outbound Calls</p>
                <p className="text-lg font-semibold" style={{ color: COLORS.purple }}>{results.users[0].outboundCalls}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: COLORS.textSecondary }}>Connect Rate</p>
                <p className="text-lg font-semibold" style={{ color: COLORS.green }}>{results.users[0].connectRate}%</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: COLORS.textSecondary }}>Longest Call</p>
                <p className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>
                  {formatDuration(results.users[0].longestCallSeconds)}
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: COLORS.textSecondary }}>Calls over {results.thresholdMinutes}+ min</span>
                <span style={{ color: COLORS.green }}>
                  {results.users[0].callsOverThreshold} / {results.users[0].totalCalls}
                </span>
              </div>
              <div className="h-3 rounded-full" style={{ backgroundColor: COLORS.bgCardAlt }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: COLORS.green,
                    width: `${(results.users[0].callsOverThreshold / results.users[0].totalCalls) * 100}%`,
                  }}
                />
              </div>
            </div>
          </Card>
        ) : (
          // Multi-User Comparison
          <>
            {/* Bar Chart */}
            <Card style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }} className="p-5">
              <h3 className="text-sm font-medium mb-4" style={{ color: COLORS.textSecondary }}>
                Calls Over {results.thresholdMinutes}+ Minutes by Team Member
              </h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userChartData} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <XAxis type="number" stroke={COLORS.textSecondary} fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke={COLORS.textSecondary} fontSize={12} width={75} />
                    <Tooltip
                      contentStyle={{ backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.borderColor}` }}
                      labelStyle={{ color: COLORS.textPrimary }}
                    />
                    <Bar dataKey="calls" radius={[0, 4, 4, 0]}>
                      {userChartData.map((entry, idx) => (
                        <Cell key={idx} fill={getRankColor(entry.rank)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Leaderboard Table */}
            <Card style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: COLORS.bgCardAlt }}>
                      <th className="text-left p-3 font-medium" style={{ color: COLORS.textSecondary }}>Rank</th>
                      <th className="text-left p-3 font-medium" style={{ color: COLORS.textSecondary }}>Name</th>
                      <th className="text-right p-3 font-medium" style={{ color: COLORS.textSecondary }}>Total</th>
                      <th className="text-right p-3 font-medium" style={{ color: COLORS.textSecondary }}>Over {results.thresholdMinutes}m</th>
                      <th className="text-right p-3 font-medium" style={{ color: COLORS.textSecondary }}>%</th>
                      <th className="text-right p-3 font-medium" style={{ color: COLORS.textSecondary }}>Avg Dur</th>
                      <th className="text-right p-3 font-medium" style={{ color: COLORS.textSecondary }}>Talk Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.users.map((user, idx) => (
                      <tr key={user.user} style={{ borderBottom: `1px solid ${COLORS.borderColor}` }}>
                        <td className="p-3">
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: getRankColor(idx + 1) + "33",
                              color: getRankColor(idx + 1),
                            }}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="p-3 font-medium" style={{ color: COLORS.textPrimary }}>{user.user}</td>
                        <td className="p-3 text-right" style={{ color: COLORS.textSecondary }}>{user.totalCalls}</td>
                        <td className="p-3 text-right font-semibold" style={{ color: COLORS.green }}>
                          {user.callsOverThreshold}
                        </td>
                        <td className="p-3 text-right" style={{ color: COLORS.textSecondary }}>
                          {Math.round((user.callsOverThreshold / user.totalCalls) * 100)}%
                        </td>
                        <td className="p-3 text-right" style={{ color: COLORS.textSecondary }}>
                          {formatDuration(user.avgDurationSeconds)}
                        </td>
                        <td className="p-3 text-right" style={{ color: COLORS.textSecondary }}>
                          {formatTalkTime(user.totalTalkTimeSeconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* Breakdown Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inbound vs Outbound */}
          <Card style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }} className="p-5">
            <h3 className="text-sm font-medium mb-4" style={{ color: COLORS.textSecondary }}>
              Call Direction Breakdown
            </h3>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: COLORS.blue }}>Inbound</span>
                  <span style={{ color: COLORS.textSecondary }}>{results.totals.inboundCalls}</span>
                </div>
                <div className="h-4 rounded-full" style={{ backgroundColor: COLORS.bgCardAlt }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: COLORS.blue,
                      width: `${(results.totals.inboundCalls / results.totals.totalCalls) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: COLORS.purple }}>Outbound</span>
                  <span style={{ color: COLORS.textSecondary }}>{results.totals.outboundCalls}</span>
                </div>
                <div className="h-4 rounded-full" style={{ backgroundColor: COLORS.bgCardAlt }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: COLORS.purple,
                      width: `${(results.totals.outboundCalls / results.totals.totalCalls) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${COLORS.borderColor}` }}>
              <p className="text-xs" style={{ color: COLORS.textSecondary }}>Overall Connect Rate</p>
              <p className="text-2xl font-bold" style={{ color: COLORS.green }}>{results.totals.connectRate}%</p>
            </div>
          </Card>

          {/* Hourly Activity */}
          <Card style={{ backgroundColor: COLORS.bgCard, borderColor: COLORS.borderColor }} className="p-5">
            <h3 className="text-sm font-medium mb-4" style={{ color: COLORS.textSecondary }}>
              Calls by Hour of Day
            </h3>
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ left: -20, right: 10 }}>
                  <XAxis dataKey="label" stroke={COLORS.textSecondary} fontSize={10} tickLine={false} />
                  <YAxis stroke={COLORS.textSecondary} fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.borderColor}` }}
                    labelStyle={{ color: COLORS.textPrimary }}
                  />
                  <Bar dataKey="calls" fill={COLORS.cyan} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4" style={{ borderTop: `1px solid ${COLORS.borderColor}` }}>
          <p className="text-xs" style={{ color: COLORS.textSecondary }}>Generated by AgencyBrain</p>
          <p className="text-xs" style={{ color: COLORS.textSecondary }}>
            {format(new Date(), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
      </div>
    </div>
  );
}
