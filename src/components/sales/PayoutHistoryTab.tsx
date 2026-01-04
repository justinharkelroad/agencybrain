import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePayoutCalculator, CompPayout } from "@/hooks/usePayoutCalculator";
import { ProducerStatementExport } from "./ProducerStatementExport";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileDown, CheckCircle, DollarSign, History } from "lucide-react";
import { format } from "date-fns";

interface PayoutHistoryTabProps {
  agencyId: string | null;
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "finalized", label: "Finalized" },
  { value: "paid", label: "Paid" },
];

export function PayoutHistoryTab({ agencyId }: PayoutHistoryTabProps) {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [exportPayout, setExportPayout] = useState<CompPayout | null>(null);

  const { teamMembers, finalizePayouts, markPaid, isFinalizingPayouts, isMarkingPaid } = usePayoutCalculator(agencyId);

  // Fetch payouts for the selected period
  const { data: payouts = [], isLoading, refetch } = useQuery<CompPayout[]>({
    queryKey: ["comp-payouts-history", agencyId, selectedMonth, selectedYear],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comp_payouts")
        .select("*")
        .eq("agency_id", agencyId!)
        .eq("period_month", selectedMonth)
        .eq("period_year", selectedYear)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Filter payouts based on selected filters
  const filteredPayouts = payouts.filter((p) => {
    if (selectedStatus !== "all" && p.status !== selectedStatus) return false;
    if (selectedMemberId !== "all" && p.team_member_id !== selectedMemberId) return false;
    return true;
  });

  // Calculate totals
  const totals = filteredPayouts.reduce(
    (acc, p) => ({
      writtenPremium: acc.writtenPremium + (p.written_premium || 0),
      netPremium: acc.netPremium + (p.net_premium || 0),
      totalPayout: acc.totalPayout + (p.total_payout || 0),
    }),
    { writtenPremium: 0, netPremium: 0, totalPayout: 0 }
  );

  // Count statuses
  const draftCount = payouts.filter((p) => p.status === "draft").length;
  const finalizedCount = payouts.filter((p) => p.status === "finalized").length;

  const getTeamMemberName = (teamMemberId: string) => {
    const member = teamMembers.find((m) => m.id === teamMemberId);
    return member?.name || "Unknown";
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "finalized":
        return <Badge variant="default">Finalized</Badge>;
      case "paid":
        return <Badge className="bg-green-600 hover:bg-green-700">Paid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleFinalizeAll = () => {
    finalizePayouts({ month: selectedMonth, year: selectedYear });
  };

  const handleMarkAllPaid = () => {
    markPaid({ month: selectedMonth, year: selectedYear });
  };

  // Generate year options (current year and 2 years back)
  const yearOptions = Array.from({ length: 3 }, (_, i) => today.getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Payout History
          </CardTitle>
          <CardDescription>View and manage historical compensation payouts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Month</label>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Year</label>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Team Member</label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {payouts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {draftCount > 0 && (
            <Button onClick={handleFinalizeAll} disabled={isFinalizingPayouts}>
              {isFinalizingPayouts ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Finalize All Drafts ({draftCount})
            </Button>
          )}
          {finalizedCount > 0 && (
            <Button variant="secondary" onClick={handleMarkAllPaid} disabled={isMarkingPaid}>
              {isMarkingPaid ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <DollarSign className="h-4 w-4 mr-2" />
              )}
              Mark All Paid ({finalizedCount})
            </Button>
          )}
        </div>
      )}

      {/* Payouts Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPayouts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No payouts found for {MONTHS[selectedMonth - 1].label} {selectedYear}</p>
              <p className="text-sm mt-1">Calculate payouts from a statement report first</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Member</TableHead>
                      <TableHead className="text-right">Written Premium</TableHead>
                      <TableHead className="text-right">Net Premium</TableHead>
                      <TableHead className="text-right">Tier Rate</TableHead>
                      <TableHead className="text-right">Total Payout</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium">
                          {getTeamMemberName(payout.team_member_id)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${(payout.written_premium || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          ${(payout.net_premium || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {payout.tier_commission_value != null 
                            ? `${payout.tier_commission_value}%` 
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${(payout.total_payout || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>{getStatusBadge(payout.status)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setExportPayout(payout)}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total ({filteredPayouts.length})</TableCell>
                      <TableCell className="text-right">
                        ${totals.writtenPremium.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        ${totals.netPremium.toLocaleString()}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">
                        ${totals.totalPayout.toLocaleString()}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Export Modal */}
      {exportPayout && (
        <ProducerStatementExport
          payout={exportPayout}
          agencyId={agencyId}
          teamMemberName={getTeamMemberName(exportPayout.team_member_id)}
          onClose={() => setExportPayout(null)}
        />
      )}
    </div>
  );
}
