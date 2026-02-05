import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { formatDateLocal } from "@/lib/utils";
import { SaleDetailModal } from "./SaleDetailModal";
import { StaffEditSaleModal } from "@/components/staff/StaffEditSaleModal";

export type DrillDownFilterType = 'date' | 'policy_type' | 'lead_source' | 'bundle_type' | 'zipcode';

interface DrillDownTableProps {
  filter: {
    type: DrillDownFilterType;
    value: string;
    displayLabel: string;
  };
  agencyId: string;
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onClear: () => void;
  staffSessionToken?: string;
  canEditAllSales?: boolean;
  currentTeamMemberId?: string;
  leadSources?: { id: string; name: string }[];
  teamMemberId?: string;
}

interface SaleRecord {
  id: string;
  sale_date: string;
  customer_name: string;
  lead_source_name: string | null;
  producer_name: string | null;
  total_items: number;
  total_premium: number;
  total_points: number;
}

interface DrillDownResponse {
  data: SaleRecord[];
  total_count: number;
}

// Minimal sale structure for staff edit modal
interface StaffSaleForEdit {
  id: string;
  sale_date: string;
  customer_name: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_zip?: string | null;
  lead_source_id?: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
}

export function DrillDownTable({
  filter,
  agencyId,
  startDate,
  endDate,
  page,
  pageSize,
  onPageChange,
  onClear,
  staffSessionToken,
  canEditAllSales = false,
  currentTeamMemberId,
  leadSources = [],
  teamMemberId,
}: DrillDownTableProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [editSaleId, setEditSaleId] = useState<string | null>(null);
  const [editSaleData, setEditSaleData] = useState<StaffSaleForEdit | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["drill-down", agencyId, filter.type, filter.value, startDate, endDate, page, pageSize, staffSessionToken, teamMemberId],
    queryFn: async (): Promise<DrillDownResponse> => {
      // Staff path - use edge function
      if (staffSessionToken) {
        const { data: result, error } = await supabase.functions.invoke('get_staff_sales_analytics', {
          headers: { 'x-staff-session': staffSessionToken },
          body: {
            type: 'drilldown',
            filter_type: filter.type,
            filter_value: filter.value,
            start_date: startDate,
            end_date: endDate,
            page,
            page_size: pageSize,
            ...(teamMemberId ? { team_member_id: teamMemberId } : {}),
          }
        });
        if (error) throw error;
        if (result?.error) throw new Error(result.error);
        return result as DrillDownResponse;
      }

      // Admin path - direct query with sale_policies for Motor Club filtering
      let query = supabase
        .from("sales")
        .select(`
          id, sale_date, customer_name,
          lead_source:lead_sources(name),
          team_member:team_members(name),
          sale_policies(id, policy_type_name, total_premium, total_items, total_points)
        `, { count: 'exact' })
        .eq("agency_id", agencyId)
        .gte("sale_date", startDate)
        .lte("sale_date", endDate)
        .order("sale_date", { ascending: false });

      // Apply filter based on type
      if (filter.type === 'date') {
        query = query.eq('sale_date', filter.value);
      } else if (filter.type === 'lead_source') {
        if (filter.value === 'Not Set') {
          query = query.is('lead_source_id', null);
        } else {
          // Need to get lead_source_id from name first
          const { data: leadSourcesData } = await supabase
            .from("lead_sources")
            .select("id")
            .eq("agency_id", agencyId)
            .eq("name", filter.value)
            .limit(1);
          
          if (leadSourcesData && leadSourcesData.length > 0) {
            query = query.eq('lead_source_id', leadSourcesData[0].id);
          } else {
            return { data: [], total_count: 0 };
          }
        }
      } else if (filter.type === 'bundle_type') {
        if (filter.value === '__all__') {
          // No bundle filter — show all bundles (used by bundle mix drill-down)
        } else if (filter.value === 'Monoline') {
          query = query.is('bundle_type', null);
        } else {
          query = query.eq('bundle_type', filter.value);
        }
      } else if (filter.type === 'zipcode') {
        query = query.eq('customer_zip', filter.value);
      } else if (filter.type === 'policy_type') {
        // Complex join: Find sale_ids that contain this policy type
        // Step 1: Get sale_policies that have items with this product_type_name
        const { data: saleItems } = await supabase
          .from("sale_items")
          .select("sale_policy_id")
          .eq("product_type_name", filter.value);

        if (!saleItems || saleItems.length === 0) {
          return { data: [], total_count: 0 };
        }

        const salePolicyIds = [...new Set(saleItems.map(i => i.sale_policy_id))];

        const { data: salePoliciesData } = await supabase
          .from("sale_policies")
          .select("sale_id")
          .in("id", salePolicyIds);

        if (!salePoliciesData || salePoliciesData.length === 0) {
          return { data: [], total_count: 0 };
        }

        const saleIds = [...new Set(salePoliciesData.map(p => p.sale_id))];
        query = query.in('id', saleIds);
      }

      // Filter by specific team member (for bundle mix drill-down)
      if (teamMemberId) {
        query = query.eq('team_member_id', teamMemberId);
      }

      // Apply pagination
      const { data: sales, count, error: queryError } = await query
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (queryError) throw queryError;

      const records: SaleRecord[] = (sales || []).map((sale: any) => {
        // Calculate countable totals (excluding Motor Club)
        const policies = sale.sale_policies || [];
        const countable = calculateCountableTotals(policies);
        
        return {
          id: sale.id,
          sale_date: sale.sale_date,
          customer_name: sale.customer_name || "Unknown",
          lead_source_name: sale.lead_source?.name || null,
          producer_name: sale.team_member?.name || null,
          total_items: countable.items,
          total_premium: countable.premium,
          total_points: countable.points,
        };
      });

      return { data: records, total_count: count || 0 };
    },
    enabled: !!agencyId && (!!filter.value || !!teamMemberId),
  });

  const totalCount = data?.total_count || 0;
  const records = data?.data || [];
  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);
  const hasNextPage = page * pageSize < totalCount;
  const hasPrevPage = page > 1;

  const handleCustomerClick = (record: SaleRecord) => {
    setSelectedSaleId(record.id);
  };

  const handleEditSale = (saleId: string) => {
    // Close the detail modal
    setSelectedSaleId(null);
    
    if (staffSessionToken) {
      // Staff flow - use StaffEditSaleModal
      const record = records.find(r => r.id === saleId);
      if (record) {
        setEditSaleData({
          id: record.id,
          sale_date: record.sale_date,
          customer_name: record.customer_name,
          total_premium: record.total_premium,
          total_items: record.total_items,
          total_points: record.total_points,
        });
        setEditSaleId(saleId);
      }
    } else {
      // Admin/Owner flow - navigate to Sales page edit mode
      navigate(`/sales?tab=add&edit=${saleId}`);
    }
  };

  const handleEditModalClose = (open: boolean) => {
    if (!open) {
      setEditSaleId(null);
      setEditSaleData(null);
      // Invalidate queries to refresh data after edit
      queryClient.invalidateQueries({ queryKey: ["drill-down"] });
      queryClient.invalidateQueries({ queryKey: ["sale-detail"] });
    }
  };

  if (isLoading) {
    return (
      <div className="mt-6 border-t border-border pt-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 border-t border-border pt-6">
        <div className="flex items-center justify-center py-12 text-destructive">
          <p>Error loading data: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-foreground">
          Sales for {filter.displayLabel} ({totalCount.toLocaleString()} records)
        </h4>
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1">
          <X className="h-4 w-4" />
          Clear Selection
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <p>No records found</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Lead Source</TableHead>
                  <TableHead>Producer</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {formatDateLocal(record.sale_date)}
                    </TableCell>
                    <TableCell>
                      <button
                        className="text-left hover:underline hover:text-primary transition-colors cursor-pointer font-medium"
                        onClick={() => handleCustomerClick(record)}
                      >
                        {record.customer_name}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.lead_source_name || "Not Set"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.producer_name || "—"}
                    </TableCell>
                    <TableCell className="text-right">{record.total_items}</TableCell>
                    <TableCell className="text-right">${record.total_premium.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{record.total_points}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalCount > pageSize && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {startRecord}-{endRecord} of {totalCount.toLocaleString()}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(page - 1)}
                  disabled={!hasPrevPage}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(page + 1)}
                  disabled={!hasNextPage}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sale Detail Modal */}
      <SaleDetailModal
        saleId={selectedSaleId}
        open={!!selectedSaleId}
        onOpenChange={(open) => !open && setSelectedSaleId(null)}
        onEdit={handleEditSale}
        canEditAllSales={canEditAllSales}
        currentTeamMemberId={currentTeamMemberId}
        staffSessionToken={staffSessionToken}
      />

      {/* Staff Edit Modal (uses edge function) */}
      {staffSessionToken && editSaleData && (
        <StaffEditSaleModal
          sale={editSaleData}
          open={!!editSaleId}
          onOpenChange={handleEditModalClose}
          sessionToken={staffSessionToken}
          leadSources={leadSources}
        />
      )}
    </div>
  );
}
