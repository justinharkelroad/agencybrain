import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesLog } from "@/components/sales/SalesLog";
import { AddSaleForm } from "@/components/sales/AddSaleForm";
import { SalesGoals } from "@/components/sales/SalesGoals";
import { PdfUploadForm } from "@/components/sales/PdfUploadForm";
import { PromoGoalsList } from "@/components/sales/PromoGoalsList";
import { SalesBreakdownTabs } from "@/components/sales/SalesBreakdownTabs";
import { CompPlansTab } from "@/components/sales/CompPlansTab";
import { Loader2 } from "lucide-react";

export default function Sales() {
  const { isAdmin, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "log");
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  // Sync tab from URL on mount and when URL changes
  useEffect(() => {
    const validTabs = ["log", "add", "upload", "analytics", "goals", "compensation"];
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Handle edit param from URL (for navigation from DrillDownTable)
  const editParam = searchParams.get("edit");
  useEffect(() => {
    if (editParam) {
      setEditingSaleId(editParam);
      setActiveTab("add");
    }
  }, [editParam]);

  // Fetch agency ID
  useEffect(() => {
    async function fetchAgencyId() {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .maybeSingle();
      setAgencyId(data?.agency_id || null);
    }
    fetchAgencyId();
  }, [user?.id]);

  // Fetch sale data for editing
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
          team_member_id,
          sale_date,
          is_bundle,
          bundle_type
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
          is_vc_qualifying
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
  });

  // Admin-only access
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSaleCreated = () => {
    setActiveTab("log");
    setEditingSaleId(null);
  };

  const handleEditSale = (saleId: string) => {
    setEditingSaleId(saleId);
    setActiveTab("add");
  };

  const handleCancelEdit = () => {
    setEditingSaleId(null);
    setActiveTab("log");
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Update URL without navigation
    setSearchParams(tab === "log" ? {} : { tab });
    // Clear editing state when switching to log tab
    if (tab === "log") {
      setEditingSaleId(null);
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
              onCancelEdit={handleCancelEdit}
              key={editingSaleId || "new"}
            />
          )}
        </TabsContent>

        <TabsContent value="upload" className="mt-6">
          <PdfUploadForm 
            agencyId={agencyId}
            onSuccess={handleSaleCreated}
            onSwitchToManual={handleSwitchToManualEntry}
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
