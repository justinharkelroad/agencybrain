import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarIcon, Loader2, Pencil, Trash2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { SaleDetailModal } from "./SaleDetailModal";

type Sale = {
  id: string;
  sale_date: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_zip: string | null;
  team_member_id: string | null;
  total_policies: number | null;
  total_items: number | null;
  total_premium: number | null;
  total_points: number | null;
  is_vc_qualifying: boolean | null;
  is_bundle: boolean | null;
  bundle_type: string | null;
  lead_source_id: string | null;
  lead_source?: {
    name: string;
  } | null;
  team_member?: {
    name: string;
  } | null;
};

type TeamMember = {
  id: string;
  name: string;
};

interface SalesLogProps {
  onEditSale?: (saleId: string) => void;
}

export function SalesLog({ onEditSale }: SalesLogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedProducer, setSelectedProducer] = useState<string>("all");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
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
          customer_email,
          customer_phone,
          customer_zip,
          team_member_id,
          total_policies,
          total_items,
          total_premium,
          total_points,
          is_vc_qualifying,
          is_bundle,
          bundle_type,
          lead_source_id,
          lead_source:lead_sources(name),
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
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Delete sale mutation
  const deleteSale = useMutation({
    mutationFn: async (saleId: string) => {
      // First get the policy IDs
      const { data: policies, error: policiesError } = await supabase
        .from("sale_policies")
        .select("id")
        .eq("sale_id", saleId);
      
      if (policiesError) throw policiesError;

      // Delete items linked to policies
      if (policies && policies.length > 0) {
        const policyIds = policies.map(p => p.id);
        const { error: itemsError } = await supabase
          .from("sale_items")
          .delete()
          .in("sale_policy_id", policyIds);
        if (itemsError) throw itemsError;
      }

      // Delete any orphan items linked directly to sale
      const { error: orphanItemsError } = await supabase
        .from("sale_items")
        .delete()
        .eq("sale_id", saleId);
      if (orphanItemsError) throw orphanItemsError;

      // Delete policies
      const { error: deletePoliciesError } = await supabase
        .from("sale_policies")
        .delete()
        .eq("sale_id", saleId);
      if (deletePoliciesError) throw deletePoliciesError;

      // Delete the sale
      const { error: saleError } = await supabase
        .from("sales")
        .delete()
        .eq("id", saleId);
      if (saleError) throw saleError;

      return saleId;
    },
    onSuccess: () => {
      toast.success("Sale deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      console.error("Error deleting sale:", error);
      toast.error("Failed to delete sale");
    },
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

  const handleRowClick = (saleId: string) => {
    setSelectedSaleId(saleId);
  };

  const handleEditClick = (e: React.MouseEvent, saleId: string) => {
    e.stopPropagation();
    onEditSale?.(saleId);
  };

  const handleDeleteClick = (e: React.MouseEvent, saleId: string) => {
    e.stopPropagation();
    setDeleteConfirmId(saleId);
  };

  return (
    <>
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
                      <TableHead>Lead Source</TableHead>
                      <TableHead>Producer</TableHead>
                      <TableHead className="text-center">Policies</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="text-center">VC</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow 
                        key={sale.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(sale.id)}
                      >
                        <TableCell>
                          {sale.sale_date
                            ? format(new Date(sale.sale_date), "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>{sale.customer_name}</div>
                          {sale.is_bundle && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {sale.bundle_type || "Bundle"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {sale.lead_source?.name || "—"}
                        </TableCell>
                        <TableCell>
                          {sale.team_member?.name || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {sale.total_policies || 0}
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
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSaleId(sale.id);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => handleEditClick(e, sale.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => handleDeleteClick(e, sale.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Sale Detail Modal */}
      <SaleDetailModal
        saleId={selectedSaleId}
        open={!!selectedSaleId}
        onOpenChange={(open) => !open && setSelectedSaleId(null)}
        onEdit={(saleId) => {
          setSelectedSaleId(null);
          onEditSale?.(saleId);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sale? This will also delete all associated policies and line items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && deleteSale.mutate(deleteConfirmId)}
              disabled={deleteSale.isPending}
            >
              {deleteSale.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
