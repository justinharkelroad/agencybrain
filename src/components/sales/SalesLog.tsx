import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Sale = {
  id: string;
  sale_date: string | null;
  customer_name: string;
  team_member_id: string | null;
  total_items: number | null;
  total_premium: number | null;
  total_points: number | null;
  is_vc_qualifying: boolean | null;
  team_member?: {
    name: string;
  } | null;
};

type TeamMember = {
  id: string;
  name: string;
};

export function SalesLog() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedProducer, setSelectedProducer] = useState<string>("all");

  // Fetch user's agency_id
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch team members for filter dropdown
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["team-members-active", profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name")
        .eq("agency_id", profile.agency_id)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.agency_id,
  });

  // Fetch sales with filters
  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: [
      "sales",
      profile?.agency_id,
      dateRange.from,
      dateRange.to,
      selectedProducer,
    ],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      let query = supabase
        .from("sales")
        .select(
          `
          id,
          sale_date,
          customer_name,
          team_member_id,
          total_items,
          total_premium,
          total_points,
          is_vc_qualifying,
          team_member:team_members!sales_team_member_id_fkey(name)
        `
        )
        .eq("agency_id", profile.agency_id)
        .gte("sale_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("sale_date", format(dateRange.to, "yyyy-MM-dd"))
        .order("sale_date", { ascending: false });

      if (selectedProducer !== "all") {
        query = query.eq("team_member_id", selectedProducer);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Sale[];
    },
    enabled: !!profile?.agency_id,
  });

  // Calculate totals
  const totals = useMemo(() => {
    return sales.reduce(
      (acc, sale) => ({
        items: acc.items + (sale.total_items || 0),
        premium: acc.premium + (sale.total_premium || 0),
        points: acc.points + (sale.total_points || 0),
      }),
      { items: 0, premium: 0, points: 0 }
    );
  }, [sales]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <span>Sales Log</span>
          <div className="flex flex-wrap gap-3">
            {/* Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal min-w-[240px]",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM d, yyyy")} -{" "}
                        {format(dateRange.to, "MMM d, yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM d, yyyy")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            {/* Producer Filter */}
            <Select value={selectedProducer} onValueChange={setSelectedProducer}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Producers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Producers</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No sales found for this period.
          </div>
        ) : (
          <>
            {/* Summary Row */}
            <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold">{totals.items}</div>
                <div className="text-sm text-muted-foreground">Total Items</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  ${totals.premium.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Premium
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{totals.points}</div>
                <div className="text-sm text-muted-foreground">
                  Total Points
                </div>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Producer</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Premium</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-center">VC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {sale.sale_date
                          ? format(new Date(sale.sale_date), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {sale.customer_name}
                      </TableCell>
                      <TableCell>
                        {sale.team_member?.name || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {sale.total_items || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        ${(sale.total_premium || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {sale.total_points || 0}
                      </TableCell>
                      <TableCell className="text-center">
                        {sale.is_vc_qualifying ? (
                          <Badge variant="default" className="bg-green-600">
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
