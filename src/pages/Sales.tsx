import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesLog } from "@/components/sales/SalesLog";
import { AddSaleForm } from "@/components/sales/AddSaleForm";
import { Loader2 } from "lucide-react";

export default function Sales() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("log");
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

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
    // Clear editing state when switching to log tab
    if (tab === "log") {
      setEditingSaleId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Sales</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="log">Sales Log</TabsTrigger>
          <TabsTrigger value="add">
            {editingSaleId ? "Edit Sale" : "Add Sale"}
          </TabsTrigger>
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
      </Tabs>
    </div>
  );
}
