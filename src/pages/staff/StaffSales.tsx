import { useState, useEffect } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { hasSalesAccess } from "@/lib/salesBetaAccess";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { formatDateLocal } from "@/lib/utils";
import { Loader2, DollarSign, Package, FileText, Trophy, Pencil, Wallet } from "lucide-react";
import { SalesLeaderboard } from "@/components/sales/SalesLeaderboard";
import { SalesBreakdownTabs } from "@/components/sales/SalesBreakdownTabs";
import { StaffCommissionWidget } from "@/components/sales/StaffCommissionWidget";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PdfUploadForm } from "@/components/sales/PdfUploadForm";
import { StaffAddSaleForm } from "@/components/sales/StaffAddSaleForm";
import { StaffEditSaleModal } from "@/components/staff/StaffEditSaleModal";
import { Button } from "@/components/ui/button";

interface SalePolicy {
  id: string;
  policy_type_name: string | null;
  policy_number: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
}

interface Sale {
  id: string;
  sale_date: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_zip: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
  lead_source_id: string | null;
  sale_policies: SalePolicy[];
}

interface LeadSource {
  id: string;
  name: string;
}

interface StaffSalesResponse {
  personal_sales: Sale[];
  totals: {
    premium: number;
    items: number;
    points: number;
    policies: number;
  };
  leaderboard: Array<{
    team_member_id: string;
    name: string;
    premium: number;
    items: number;
    points: number;
    policies: number;
  }>;
  team_member_id: string | null;
  agency_id: string;
  lead_sources: LeadSource[];
}

export default function StaffSales() {
  const { user, sessionToken } = useStaffAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  // Sync tab with URL
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleSwitchToManualEntry = () => {
    handleTabChange("add");
  };
  
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
  
  const agencyId = user?.agency_id;

  // Debug logging for client-side
  console.log('[StaffSales] sessionToken present?', !!sessionToken);

  // Fetch staff's sales using edge function (bypasses RLS)
  const { data: salesResponse, isLoading, error } = useQuery({
    queryKey: ["staff-sales", agencyId, monthStart, monthEnd, sessionToken],
    queryFn: async (): Promise<StaffSalesResponse | null> => {
      if (!sessionToken) {
        console.log('[StaffSales] No session token, skipping fetch');
        return null;
      }

      console.log('[StaffSales] Invoking get_staff_sales edge function');
      const { data, error } = await supabase.functions.invoke('get_staff_sales', {
        headers: { 'x-staff-session': sessionToken },
        body: { 
          date_start: monthStart, 
          date_end: monthEnd,
          include_leaderboard: true 
        }
      });

      if (error) {
        console.error('[StaffSales] Edge function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('[StaffSales] Response error:', data.error);
        throw new Error(data.error);
      }

      console.log('[StaffSales] Success - got sales data');
      return data as StaffSalesResponse;
    },
    enabled: !!sessionToken && !!agencyId,
  });

  const salesData = salesResponse?.personal_sales || [];
  const totals = salesResponse?.totals || { premium: 0, items: 0, points: 0, policies: 0 };
  const leadSources = salesResponse?.lead_sources || [];

  const handleSaleCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["staff-sales"] });
    setActiveTab("overview");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Guard: only beta agencies can access staff sales
  if (!hasSalesAccess(user.agency_id ?? null)) {
    return <Navigate to="/staff/dashboard" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">My Sales</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex w-full overflow-x-auto no-scrollbar gap-1 md:grid md:grid-cols-7 md:max-w-4xl">
          <TabsTrigger value="overview" className="flex-shrink-0">Overview</TabsTrigger>
          <TabsTrigger value="history" className="flex-shrink-0">History</TabsTrigger>
          <TabsTrigger value="add" className="flex-shrink-0">Add Sale</TabsTrigger>
          <TabsTrigger value="upload" className="flex-shrink-0">Upload PDF</TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex-shrink-0">Leaderboard</TabsTrigger>
          <TabsTrigger value="analytics" className="flex-shrink-0">Analytics</TabsTrigger>
          <TabsTrigger value="compensation" className="flex-shrink-0">
            <Wallet className="h-4 w-4 mr-1 md:mr-0 lg:mr-1" />
            <span className="hidden lg:inline">Compensation</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Month Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Premium</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${totals.premium.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(today, "MMMM yyyy")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Items</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totals.items}</div>
                <p className="text-xs text-muted-foreground">Total items sold</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Policies</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totals.policies}</div>
                <p className="text-xs text-muted-foreground">Total policies</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Points</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totals.points}</div>
                <p className="text-xs text-muted-foreground">Total points</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Sales Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : salesData && salesData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesData.slice(0, 5).map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {formatDateLocal(sale.sale_date)}
                        </TableCell>
                        <TableCell>{sale.customer_name}</TableCell>
                        <TableCell className="text-right">
                          ${(sale.total_premium || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {sale.total_items || 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No sales recorded this month.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales History - {format(today, "MMMM yyyy")}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : salesData && salesData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Lead Source</TableHead>
                      <TableHead>Policies</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesData.map((sale) => {
                      const leadSourceName = leadSources.find(ls => ls.id === sale.lead_source_id)?.name || "—";
                      return (
                        <TableRow key={sale.id}>
                          <TableCell>
                            {formatDateLocal(sale.sale_date)}
                          </TableCell>
                          <TableCell>{sale.customer_name}</TableCell>
                          <TableCell>{leadSourceName}</TableCell>
                          <TableCell>
                            {sale.sale_policies?.map((p) => p.policy_type_name).join(", ") || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            ${(sale.total_premium || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {sale.total_items || 0}
                          </TableCell>
                          <TableCell className="text-right">
                            {sale.total_points || 0}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingSale(sale)}
                              className="h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No sales recorded this month.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add" className="mt-6">
          <StaffAddSaleForm
            agencyId={agencyId}
            staffSessionToken={sessionToken || undefined}
            staffTeamMemberId={user?.team_member_id}
            leadSources={leadSources}
            onSuccess={handleSaleCreated}
          />
        </TabsContent>

        <TabsContent value="upload" className="mt-6">
          <PdfUploadForm
            agencyId={agencyId}
            staffSessionToken={sessionToken || undefined}
            staffUserId={user?.id}
            staffTeamMemberId={user?.team_member_id}
            leadSources={leadSources}
            onSuccess={handleSaleCreated}
            onSwitchToManual={handleSwitchToManualEntry}
          />
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-6">
          {agencyId && (
            <SalesLeaderboard 
              agencyId={agencyId} 
              staffSessionToken={sessionToken || undefined}
            />
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          {agencyId && (
            <SalesBreakdownTabs 
              agencyId={agencyId}
              showLeaderboard={false}
              staffSessionToken={sessionToken || undefined}
            />
          )}
        </TabsContent>

        <TabsContent value="compensation" className="mt-6">
          {sessionToken && <StaffCommissionWidget sessionToken={sessionToken} />}
        </TabsContent>
      </Tabs>

      {/* Edit Sale Modal */}
      {sessionToken && (
        <StaffEditSaleModal
          sale={editingSale}
          open={!!editingSale}
          onOpenChange={(open) => !open && setEditingSale(null)}
          sessionToken={sessionToken}
          leadSources={leadSources}
        />
      )}
    </div>
  );
}
