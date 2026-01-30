import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateCountableTotals } from "@/lib/product-constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateLocal } from "@/lib/utils";
import { FileText } from "lucide-react";

interface SalesPeriodSummaryTableProps {
  agencyId: string | null;
  startDate: string;
  endDate: string;
  staffSessionToken?: string;
  businessFilter?: string;
}

interface SalePolicy {
  id: string;
  policy_type_name: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
}

interface SaleSummaryRow {
  id: string;
  sale_date: string;
  customer_name: string | null;
  lead_source_name: string | null;
  producer_name: string | null;
  premium: number;
  items: number;
  policies: number;
  points: number;
}

export function SalesPeriodSummaryTable({
  agencyId,
  startDate,
  endDate,
  staffSessionToken,
  businessFilter = "all",
}: SalesPeriodSummaryTableProps) {
  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales-period-summary-table", agencyId, startDate, endDate, staffSessionToken, businessFilter],
    queryFn: async (): Promise<SaleSummaryRow[]> => {
      if (!agencyId) return [];

      // If using staff session token, use get_staff_sales edge function
      if (staffSessionToken) {
        const { data, error } = await supabase.functions.invoke('get_staff_sales', {
          headers: { 'x-staff-session': staffSessionToken },
          body: {
            date_start: startDate,
            date_end: endDate,
            include_leaderboard: false,
            scope: "team",
            business_filter: businessFilter
          }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const salesData = data?.personal_sales || [];

        return salesData.map((sale: any) => {
          const policies = (sale.sale_policies || []) as SalePolicy[];
          const countable = calculateCountableTotals(policies);
          return {
            id: sale.id,
            sale_date: sale.sale_date,
            customer_name: sale.customer_name,
            lead_source_name: null, // get_staff_sales doesn't include lead_source
            producer_name: null, // get_staff_sales doesn't include team_member name
            premium: countable.premium,
            items: countable.items,
            policies: countable.policyCount,
            points: countable.points,
          };
        });
      }

      // Direct Supabase query for admin users
      let query = supabase
        .from("sales")
        .select(
          `id, sale_date, customer_name,
           lead_source:lead_sources(name),
           team_member:team_members(name),
           sale_policies(id, policy_type_name, total_premium, total_items, total_points)`
        )
        .eq("agency_id", agencyId)
        .gte("sale_date", startDate)
        .lte("sale_date", endDate)
        .order("sale_date", { ascending: false });

      // Apply business filter
      if (businessFilter === "regular") {
        query = query.is("brokered_carrier_id", null);
      } else if (businessFilter === "brokered") {
        query = query.not("brokered_carrier_id", "is", null);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((sale: any) => {
        const policies = (sale.sale_policies || []) as SalePolicy[];
        const countable = calculateCountableTotals(policies);
        return {
          id: sale.id,
          sale_date: sale.sale_date,
          customer_name: sale.customer_name,
          lead_source_name: sale.lead_source?.name || null,
          producer_name: sale.team_member?.name || null,
          premium: countable.premium,
          items: countable.items,
          policies: countable.policyCount,
          points: countable.points,
        };
      });
    },
    enabled: !!agencyId,
  });

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Period Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sales || sales.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Period Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mb-2 opacity-50" />
            <p>No sales in this period</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totals = sales.reduce(
    (acc, sale) => ({
      premium: acc.premium + sale.premium,
      items: acc.items + sale.items,
      policies: acc.policies + sale.policies,
      points: acc.points + sale.points,
    }),
    { premium: 0, items: 0, policies: 0, points: 0 }
  );

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Period Sales ({sales.length} sales)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border/50 overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Producer</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Policies</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {formatDateLocal(sale.sale_date, "MMM d")}
                    </TableCell>
                    <TableCell>{sale.customer_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {sale.producer_name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sale.lead_source_name || "—"}
                    </TableCell>
                    <TableCell className="text-right text-emerald-400 font-medium">
                      ${sale.premium.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-blue-400">
                      {sale.items}
                    </TableCell>
                    <TableCell className="text-right text-purple-400">
                      {sale.policies}
                    </TableCell>
                    <TableCell className="text-right text-orange-400">
                      {sale.points}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-muted/30 font-semibold border-t-2">
                  <TableCell colSpan={4} className="text-right">
                    Totals
                  </TableCell>
                  <TableCell className="text-right text-emerald-400">
                    ${totals.premium.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-blue-400">
                    {totals.items}
                  </TableCell>
                  <TableCell className="text-right text-purple-400">
                    {totals.policies}
                  </TableCell>
                  <TableCell className="text-right text-orange-400">
                    {totals.points}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
