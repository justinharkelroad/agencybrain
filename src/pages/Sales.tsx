import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasSalesAccess } from "@/lib/salesBetaAccess";
import { SalesLog } from "@/components/sales/SalesLog";
import { AddSaleForm } from "@/components/sales/AddSaleForm";
import { SalesGoals } from "@/components/sales/SalesGoals";
import { PdfUploadForm } from "@/components/sales/PdfUploadForm";
import { PromoGoalsList } from "@/components/sales/PromoGoalsList";
import { SalesBreakdownTabs } from "@/components/sales/SalesBreakdownTabs";
import { CompPlansTab } from "@/components/sales/CompPlansTab";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SalesPrefill, WinbackSaleCompletionContext } from "@/lib/lqs-sale-prefill";
import * as winbackApi from "@/lib/winbackApi";
import { toast } from "sonner";

export default function Sales() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "log");
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const locationState = (location.state as {
    prefillSale?: SalesPrefill;
    winbackCompletion?: WinbackSaleCompletionContext;
  } | null);
  const locationPrefillSale = locationState?.prefillSale ?? null;
  const locationWinbackCompletion = locationState?.winbackCompletion ?? null;
  const [prefillSale, setPrefillSale] = useState<SalesPrefill | null>(locationPrefillSale);
  const [winbackCompletion, setWinbackCompletion] = useState<WinbackSaleCompletionContext | null>(locationWinbackCompletion);

  // Sync tab from URL on mount and when URL changes
  useEffect(() => {
    const validTabs = ["log", "add", "upload", "analytics", "goals", "compensation"];
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    setPrefillSale(locationPrefillSale);
  }, [locationPrefillSale]);

  useEffect(() => {
    setWinbackCompletion(locationWinbackCompletion);
  }, [locationWinbackCompletion]);

  // Handle edit param from URL (for navigation from DrillDownTable)
  const editParam = searchParams.get("edit");
  useEffect(() => {
    if (editParam) {
      setEditingSaleId(editParam);
      setActiveTab("add");
    }
  }, [editParam]);

  const [agencyIdLoading, setAgencyIdLoading] = useState(true);

  // Fetch agency ID
  useEffect(() => {
    async function fetchAgencyId() {
      if (!user?.id) {
        setAgencyIdLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .maybeSingle();
      setAgencyId(data?.agency_id || null);
      setAgencyIdLoading(false);
    }
    fetchAgencyId();
  }, [user?.id]);

  // Fetch sale data for editing - always fresh to avoid stale lead_source_id etc
  const { data: editSaleData, isLoading: isLoadingEditSale } = useQuery({
    queryKey: ["sale-for-edit", editingSaleId],
    queryFn: async () => {
      if (!editingSaleId) return null;

      // Fetch the sale with policies and items
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .select(`
          id,
          customer_name,
          customer_email,
          customer_phone,
          customer_zip,
          lead_source_id,
          lead_source:lead_sources(name),
          prior_insurance_company_id,
          brokered_carrier_id,
          team_member_id,
          sale_date,
          is_bundle,
          bundle_type,
          existing_customer_products,
          brokered_counts_toward_bundling,
          is_one_call_close
        `)
        .eq("id", editingSaleId)
        .single();

      if (saleError) throw saleError;

      // Fetch policies for this sale
      const { data: policies, error: policiesError } = await supabase
        .from("sale_policies")
        .select(`
          id,
          product_type_id,
          policy_type_name,
          policy_number,
          effective_date,
          is_vc_qualifying,
          brokered_carrier_id
        `)
        .eq("sale_id", editingSaleId)
        .order("created_at");

      if (policiesError) throw policiesError;

      // Fetch items for all policies
      const policyIds = policies?.map(p => p.id) || [];
      let items: any[] = [];
      if (policyIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from("sale_items")
          .select(`
            id,
            sale_policy_id,
            product_type_id,
            product_type_name,
            item_count,
            premium,
            points,
            is_vc_qualifying
          `)
          .in("sale_policy_id", policyIds);

        if (itemsError) throw itemsError;
        items = itemsData || [];
      }

      // Combine policies with their items
      const policiesWithItems = (policies || []).map(policy => ({
        ...policy,
        sale_items: items.filter(item => item.sale_policy_id === policy.id)
      }));

      return {
        ...sale,
        sale_policies: policiesWithItems
      };
    },
    enabled: !!editingSaleId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Wait for agencyId to load before checking access
  if (agencyIdLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Admin or beta agency access
  if (!isAdmin && !hasSalesAccess(agencyId)) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSaleCreated = async (result?: { saleId: string }) => {
    try {
      setActiveTab("log");
      setEditingSaleId(null);
      setPrefillSale(null);
      if (winbackCompletion) {
        if (!result?.saleId) {
          throw new Error("Sale saved but no sale ID was returned");
        }

        const completion = await winbackApi.completeWonBackFromSale(winbackCompletion, result.saleId);
        if (!completion.success) {
          throw new Error(completion.error || "Failed to mark winback as won back");
        }

        queryClient.invalidateQueries({ queryKey: ["winback-households"] });
        queryClient.invalidateQueries({ queryKey: ["winback-activity-summary"] });
        queryClient.invalidateQueries({ queryKey: ["winback-stats"] });
        setWinbackCompletion(null);
        toast.success("Sale recorded and Winback marked won back");
        navigate(winbackCompletion.returnPath);
      }
    } catch (error) {
      console.error("[Sales] Failed to finalize winback sale:", error);
      toast.error(error instanceof Error ? error.message : "Sale saved but Winback could not be finalized");
    }
  };

  const handleEditSale = (saleId: string) => {
    setEditingSaleId(saleId);
    setActiveTab("add");
    setPrefillSale(null);
  };

  const handleCancelEdit = () => {
    setEditingSaleId(null);
    setActiveTab("log");
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Update URL without navigation
    setSearchParams(tab === "log" ? {} : { tab });
    // Clear editing/context state when leaving sale entry flows
    if (tab !== "add" && tab !== "upload") {
      setEditingSaleId(null);
      setPrefillSale(null);
      setWinbackCompletion(null);
    }
  };

  const handleSwitchToManualEntry = () => {
    setActiveTab("add");
    setSearchParams({ tab: "add" });
    setEditingSaleId(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Sales</h1>

      {winbackCompletion && (
        <Card className="mb-6 border-green-200 bg-green-50/60">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-green-900">Complete Winback in Sales</p>
              <p className="text-sm text-green-800">
                Use the same Add Sale or Upload PDF flow you already use. After the sale is saved, this record will automatically count as Won Back in Winback HQ.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setWinbackCompletion(null);
                setPrefillSale(null);
                navigate(winbackCompletion.returnPath);
              }}
            >
              Back to Winback
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-4xl grid-cols-6">
          <TabsTrigger value="log">Sales Log</TabsTrigger>
          <TabsTrigger value="add">
            {editingSaleId ? "Edit Sale" : "Add Sale"}
          </TabsTrigger>
          <TabsTrigger value="upload">Upload PDF</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="compensation">Compensation</TabsTrigger>
        </TabsList>

        <TabsContent value="log" className="mt-6">
          <SalesLog onEditSale={handleEditSale} />
        </TabsContent>

        <TabsContent value="add" className="mt-6">
          {isLoadingEditSale && editingSaleId ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AddSaleForm 
              onSuccess={handleSaleCreated} 
              editSale={editSaleData}
              prefillSale={prefillSale}
              onCancelEdit={handleCancelEdit}
              key={editingSaleId || (prefillSale?.source === 'lqs_household' ? prefillSale.householdId : prefillSale?.source === 'winback_household' ? prefillSale.winbackHouseholdId : 'new')}
            />
          )}
        </TabsContent>

        <TabsContent value="upload" className="mt-6">
          <PdfUploadForm 
            agencyId={agencyId}
            onSuccess={handleSaleCreated}
            onSwitchToManual={handleSwitchToManualEntry}
            prefillSale={prefillSale}
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <SalesBreakdownTabs 
            agencyId={agencyId} 
            canEditAllSales={true}
          />
        </TabsContent>

        <TabsContent value="goals" className="mt-6 space-y-6">
          <PromoGoalsList agencyId={agencyId} />
          <SalesGoals agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="compensation" className="mt-6">
          <CompPlansTab agencyId={agencyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
