import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { DollarSign, Package, FileText, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StaffSalesSummaryProps {
  agencyId: string;
  teamMemberId: string;
}

export function StaffSalesSummary({ agencyId, teamMemberId }: StaffSalesSummaryProps) {
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["staff-sales-summary", agencyId, teamMemberId, monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          total_premium,
          total_items,
          total_points,
          sale_policies(id)
        `)
        .eq("agency_id", agencyId)
        .eq("team_member_id", teamMemberId)
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd);

      if (error) throw error;

      const totals = (data || []).reduce(
        (acc, sale) => ({
          premium: acc.premium + (sale.total_premium || 0),
          items: acc.items + (sale.total_items || 0),
          points: acc.points + (sale.total_points || 0),
          policies: acc.policies + (sale.sale_policies?.length || 0),
        }),
        { premium: 0, items: 0, points: 0, policies: 0 }
      );

      return totals;
    },
    enabled: !!agencyId && !!teamMemberId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Sales - {format(today, "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Sales - {format(today, "MMMM yyyy")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Premium</p>
              <p className="text-xl font-bold">${(data?.premium || 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Items</p>
              <p className="text-xl font-bold">{data?.items || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Policies</p>
              <p className="text-xl font-bold">{data?.policies || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Points</p>
              <p className="text-xl font-bold">{data?.points || 0}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
