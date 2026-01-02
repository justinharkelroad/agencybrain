import { useState, useEffect } from "react";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Loader2, DollarSign, Package, FileText, Trophy } from "lucide-react";
import { SalesDashboardWidget } from "@/components/sales/SalesDashboardWidget";
import { SalesLeaderboard } from "@/components/sales/SalesLeaderboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function StaffSales() {
  const { user } = useStaffAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();
  
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
  
  const agencyId = user?.agency_id;
  const teamMemberId = user?.team_member_id;

  // Fetch staff's sales for current month
  const { data: salesData, isLoading } = useQuery({
    queryKey: ["staff-sales", agencyId, teamMemberId, monthStart, monthEnd],
    queryFn: async () => {
      if (!agencyId || !teamMemberId) return [];

      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          sale_date,
          customer_name,
          total_premium,
          total_items,
          total_points,
          sale_policies(id, policy_type_name)
        `)
        .eq("agency_id", agencyId)
        .eq("team_member_id", teamMemberId)
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd)
        .order("sale_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId && !!teamMemberId,
  });

  // Calculate totals
  const totals = salesData?.reduce(
    (acc, sale) => ({
      premium: acc.premium + (sale.total_premium || 0),
      items: acc.items + (sale.total_items || 0),
      points: acc.points + (sale.total_points || 0),
      policies: acc.policies + (sale.sale_policies?.length || 0),
    }),
    { premium: 0, items: 0, points: 0, policies: 0 }
  ) || { premium: 0, items: 0, points: 0, policies: 0 };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">My Sales</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
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
                          {format(new Date(sale.sale_date), "MMM d, yyyy")}
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
                      <TableHead>Policies</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesData.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {format(new Date(sale.sale_date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{sale.customer_name}</TableCell>
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

        <TabsContent value="leaderboard" className="mt-6">
          {agencyId && <SalesLeaderboard agencyId={agencyId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
