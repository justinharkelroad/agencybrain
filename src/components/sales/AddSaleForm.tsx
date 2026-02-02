import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLeadSources } from "@/hooks/useLeadSources";
import { useBrokeredCarriers } from "@/hooks/useBrokeredCarriers";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Plus, Trash2, Loader2, ChevronDown, ChevronRight, Building2, ExternalLink, Users } from "lucide-react";
import { cn, toLocalDate, todayLocal, formatPhoneNumber } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ApplySequenceModal } from "@/components/onboarding/ApplySequenceModal";

type ProductType = {
  id: string;
  name: string;
  category: string;
  default_points: number | null;
  is_vc_item: boolean | null;
};

type TeamMember = {
  id: string;
  name: string;
};

type LineItem = {
  id: string;
  product_type_id: string;
  product_type_name: string;
  item_count: number;
  premium: number | string;
  points: number;
  is_vc_qualifying: boolean;
};

type Policy = {
  id: string;
  product_type_id: string;
  policy_type_name: string;
  policy_number: string;
  effective_date: Date | undefined;
  is_vc_qualifying: boolean;
  lineItems: LineItem[];
  isExpanded: boolean;
  isBrokered: boolean;
  brokeredCarrierId: string | null;
};

type SaleForEdit = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_zip: string | null;
  lead_source_id: string | null;
  lead_source?: { name: string } | null;
  brokered_carrier_id: string | null;
  brokered_carrier?: { name: string } | null;
  team_member_id: string | null;
  sale_date: string | null;
  is_bundle: boolean | null;
  bundle_type: string | null;
  existing_customer_products: string[] | null;
  sale_policies: {
    id: string;
    product_type_id: string | null;
    policy_type_name: string;
    policy_number: string | null;
    effective_date: string;
    is_vc_qualifying: boolean | null;
    brokered_carrier_id: string | null;
    sale_items: {
      id: string;
      product_type_id: string | null;
      product_type_name: string;
      item_count: number | null;
      premium: number | null;
      points: number | null;
      is_vc_qualifying: boolean | null;
    }[];
  }[];
};

interface AddSaleFormProps {
  onSuccess?: () => void;
  editSale?: SaleForEdit | null;
  onCancelEdit?: () => void;
}


// Auto products for Preferred Bundle detection
const AUTO_PRODUCTS = ['Standard Auto', 'Non-Standard Auto', 'Specialty Auto'];
const HOME_PRODUCTS = ['Homeowners', 'North Light Homeowners', 'Condo', 'North Light Condo'];

// Helper to detect bundle type automatically
// Accepts optional existingTypes array for customers with existing policies
const detectBundleType = (
  policies: Policy[],
  existingTypes: string[] = []
): { isBundle: boolean; bundleType: string | null } => {
  const productNames = policies.map(p => p.policy_type_name).filter(Boolean);

  // Check both new policies AND existing policies
  const hasAuto = productNames.some(name =>
    AUTO_PRODUCTS.some(auto => name.toLowerCase() === auto.toLowerCase())
  ) || existingTypes.includes('auto');

  const hasHome = productNames.some(name =>
    HOME_PRODUCTS.some(home => name.toLowerCase() === home.toLowerCase())
  ) || existingTypes.includes('home');

  // Preferred Bundle: Auto + Home (either existing or new)
  if (hasAuto && hasHome) {
    return { isBundle: true, bundleType: 'Preferred' };
  }

  // Standard Bundle: Multiple policies OR 1 new + existing
  const newPolicyCount = policies.filter(p => p.policy_type_name).length;
  const totalPolicies = newPolicyCount + existingTypes.length;
  if (totalPolicies > 1) {
    return { isBundle: true, bundleType: 'Standard' };
  }

  // Monoline: Single policy
  return { isBundle: false, bundleType: null };
};

// Multi-item product types (can have multiple line items with item counts)
const MULTI_ITEM_PRODUCTS = ["Standard Auto", "Specialty Auto", "Boatowners"];

const isMultiItemProduct = (productName: string): boolean => {
  return MULTI_ITEM_PRODUCTS.some(
    (name) => productName.toLowerCase() === name.toLowerCase()
  );
};

export function AddSaleForm({ onSuccess, editSale, onCancelEdit }: AddSaleFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerZip, setCustomerZip] = useState("");
  const [leadSourceId, setLeadSourceId] = useState("");
  const [producerId, setProducerId] = useState("");
  const [saleDate, setSaleDate] = useState<Date | undefined>(todayLocal());
  const [policies, setPolicies] = useState<Policy[]>([]);

  // Existing customer state for bundle classification
  const [hasExistingPolicies, setHasExistingPolicies] = useState(false);
  const [existingPolicyTypes, setExistingPolicyTypes] = useState<string[]>([]);

  // Apply sequence modal state
  const [applySequenceModalOpen, setApplySequenceModalOpen] = useState(false);
  const [newSaleData, setNewSaleData] = useState<{
    saleId: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
  } | null>(null);

  const isEditMode = !!editSale;

  // Populate form when editing
  useEffect(() => {
    if (editSale) {
      setCustomerName(editSale.customer_name);
      setCustomerEmail(editSale.customer_email || "");
      setCustomerPhone(editSale.customer_phone || "");
      setCustomerZip(editSale.customer_zip || "");
      setLeadSourceId(editSale.lead_source_id || "");
      setProducerId(editSale.team_member_id || "");
      setSaleDate(editSale.sale_date ? toLocalDate(new Date(editSale.sale_date + 'T12:00:00')) : todayLocal());

      // Restore existing customer products state
      const existingProducts = editSale.existing_customer_products || [];
      if (existingProducts.length > 0) {
        setHasExistingPolicies(true);
        setExistingPolicyTypes(existingProducts);
      } else {
        setHasExistingPolicies(false);
        setExistingPolicyTypes([]);
      }

      // Map policies and items
      // For backward compatibility: if sale has brokered_carrier_id but policies don't,
      // treat all policies as brokered through that carrier
      const fallbackBrokeredCarrierId = editSale.brokered_carrier_id;
      const mappedPolicies: Policy[] = editSale.sale_policies.map((policy) => {
        // Per-policy brokered takes precedence, fall back to sale-level for old data
        const policyBrokeredCarrierId = policy.brokered_carrier_id ||
          (fallbackBrokeredCarrierId && !policy.product_type_id ? fallbackBrokeredCarrierId : null);
        const isBrokered = !!policyBrokeredCarrierId;

        return {
          id: policy.id,
          product_type_id: isBrokered ? "brokered" : (policy.product_type_id || ""),
          policy_type_name: policy.policy_type_name,
          policy_number: policy.policy_number || "",
          effective_date: toLocalDate(new Date(policy.effective_date + 'T12:00:00')),
          is_vc_qualifying: policy.is_vc_qualifying || false,
          isExpanded: true,
          isBrokered,
          brokeredCarrierId: policyBrokeredCarrierId,
          lineItems: policy.sale_items.map((item) => ({
            id: item.id,
            product_type_id: item.product_type_id || "",
            product_type_name: item.product_type_name,
            item_count: item.item_count || 1,
            premium: item.premium || 0,
            points: item.points || 0,
            is_vc_qualifying: item.is_vc_qualifying || false,
          })),
        };
      });
      setPolicies(mappedPolicies);
    }
  }, [editSale]);

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

  // Fetch product types (global + agency-specific)
  const { data: productTypes = [] } = useQuery<ProductType[]>({
    queryKey: ["product-types", profile?.agency_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_types")
        .select("id, name, category, default_points, is_vc_item")
        .or(`agency_id.is.null,agency_id.eq.${profile?.agency_id}`)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.agency_id,
  });

  // Fetch active team members
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

  // Fetch lead sources
  const { leadSources, loading: leadSourcesLoading } = useLeadSources();

  // Fetch brokered carriers
  const { activeCarriers: brokeredCarriers } = useBrokeredCarriers(profile?.agency_id || null);

  // Calculate policy totals
  const calculatePolicyTotals = (policy: Policy) => {
    return policy.lineItems.reduce(
      (acc, item) => ({
        items: acc.items + item.item_count,
        premium:
          acc.premium +
          (typeof item.premium === "number" ? item.premium : parseFloat(item.premium) || 0),
        points: acc.points + item.points,
      }),
      { items: 0, premium: 0, points: 0 }
    );
  };

  // Calculate overall totals
  const totals = useMemo(() => {
    return policies.reduce(
      (acc, policy) => {
        const policyTotals = calculatePolicyTotals(policy);
        return {
          items: acc.items + policyTotals.items,
          premium: acc.premium + policyTotals.premium,
          points: acc.points + policyTotals.points,
        };
      },
      { items: 0, premium: 0, points: 0 }
    );
  }, [policies]);

  // Auto-detect bundle type based on policies and existing customer products
  const bundleInfo = useMemo(
    () => detectBundleType(policies, hasExistingPolicies ? existingPolicyTypes : []),
    [policies, hasExistingPolicies, existingPolicyTypes]
  );

  // Add a new policy
  const addPolicy = () => {
    setPolicies([
      ...policies,
      {
        id: crypto.randomUUID(),
        product_type_id: "",
        policy_type_name: "",
        policy_number: "",
        effective_date: toLocalDate(saleDate) || todayLocal(),
        is_vc_qualifying: false,
        lineItems: [],
        isExpanded: true,
        isBrokered: false,
        brokeredCarrierId: null,
      },
    ]);
  };

  // Remove a policy
  const removePolicy = (policyId: string) => {
    setPolicies(policies.filter((p) => p.id !== policyId));
  };

  // Toggle policy expansion
  const togglePolicyExpand = (policyId: string) => {
    setPolicies(
      policies.map((p) =>
        p.id === policyId ? { ...p, isExpanded: !p.isExpanded } : p
      )
    );
  };

  // Update policy
  const updatePolicy = (policyId: string, field: keyof Policy, value: any) => {
    setPolicies(
      policies.map((p) => {
        if (p.id !== policyId) return p;

        const updated = { ...p, [field]: value };

        // If policy type changed, update the VC status and auto-create line item for single-item products
        if (field === "product_type_id") {
          // Handle brokered business (product_type_id = "brokered")
          if (value === "brokered") {
            updated.is_vc_qualifying = false;
            updated.isBrokered = true;
            // Auto-create a line item for brokered business if none exists
            if (p.lineItems.length === 0) {
              updated.lineItems = [
                {
                  id: crypto.randomUUID(),
                  product_type_id: "",
                  product_type_name: updated.policy_type_name || "",
                  item_count: 1,
                  premium: 0,
                  points: 0,
                  is_vc_qualifying: false,
                },
              ];
            }
          } else {
            updated.isBrokered = false;
            updated.brokeredCarrierId = null;
            const product = productTypes.find((pt) => pt.id === value);
            if (product) {
              updated.policy_type_name = product.name;
              updated.is_vc_qualifying = product.is_vc_item || false;

              // For single-item products, auto-create/update a single line item
              if (!isMultiItemProduct(product.name)) {
                // Keep existing premium if there's already a line item, otherwise start at 0
                const existingPremium = p.lineItems.length > 0 ? p.lineItems[0].premium : 0;
                updated.lineItems = [
                  {
                    id: p.lineItems.length > 0 ? p.lineItems[0].id : crypto.randomUUID(),
                    product_type_id: product.id,
                    product_type_name: product.name,
                    item_count: 1,
                    premium: existingPremium,
                    points: product.default_points || 0,
                    is_vc_qualifying: product.is_vc_item || false,
                  },
                ];
              } else {
                // For multi-item products, clear line items if switching from single-item
                // but only if there's exactly one auto-created item with same product
                if (p.lineItems.length === 1 && !isMultiItemProduct(p.policy_type_name) && p.policy_type_name) {
                  updated.lineItems = [];
                }
              }
            }
          }
        }

        // For brokered business: also update line item's product_type_name when policy_type_name changes
        if (field === "policy_type_name" && updated.isBrokered && updated.lineItems.length > 0) {
          updated.lineItems = updated.lineItems.map((item) => ({
            ...item,
            product_type_name: value,
          }));
        }

        return updated;
      })
    );
  };

  // Add line item to a policy (inherits product type from policy)
  const addLineItem = (policyId: string) => {
    setPolicies(
      policies.map((p) => {
        if (p.id !== policyId) return p;
        
        // Get the policy's product type info to inherit
        const product = productTypes.find((pt) => pt.id === p.product_type_id);
        
        return {
          ...p,
          lineItems: [
            ...p.lineItems,
            {
              id: crypto.randomUUID(),
              product_type_id: p.product_type_id,
              product_type_name: p.policy_type_name,
              item_count: 1,
              premium: 0,
              points: product?.default_points || 0,
              is_vc_qualifying: product?.is_vc_item || false,
            },
          ],
        };
      })
    );
  };

  // Remove line item from a policy
  const removeLineItem = (policyId: string, itemId: string) => {
    setPolicies(
      policies.map((p) => {
        if (p.id !== policyId) return p;
        return {
          ...p,
          lineItems: p.lineItems.filter((item) => item.id !== itemId),
        };
      })
    );
  };

  // Update line item
  const updateLineItem = (
    policyId: string,
    itemId: string,
    field: keyof LineItem,
    value: string | number | boolean
  ) => {
    setPolicies(
      policies.map((p) => {
        if (p.id !== policyId) return p;
        return {
          ...p,
          lineItems: p.lineItems.map((item) => {
            if (item.id !== itemId) return item;

            const updated = { ...item, [field]: value };

            // If product type changed, update points and VC status
            if (field === "product_type_id") {
              const product = productTypes.find((pt) => pt.id === value);
              if (product) {
                updated.product_type_name = product.name;
                updated.points = (product.default_points || 0) * updated.item_count;
                updated.is_vc_qualifying = product.is_vc_item || false;
              }
            }

            // If item count changed, recalculate points
            if (field === "item_count") {
              const product = productTypes.find(
                (pt) => pt.id === updated.product_type_id
              );
              if (product) {
                updated.points = (product.default_points || 0) * (value as number);
              }
            }

            return updated;
          }),
        };
      })
    );
  };

  // Create/Update sale mutation
  const saveSale = useMutation({
    mutationFn: async () => {
      if (!profile?.agency_id) throw new Error("No agency found");
      if (!saleDate) throw new Error("Sale date is required");
      if (!customerName.trim()) throw new Error("Customer name is required");
      if (!customerPhone.trim()) throw new Error("Phone number is required");
      if (!customerEmail.trim()) throw new Error("Email is required");
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail.trim())) {
        throw new Error("Please enter a valid email address");
      }
      if (!leadSourceId) throw new Error("Lead source is required");
      if (policies.length === 0) throw new Error("At least one policy is required");

      // Validate each policy has an effective date and at least one item
      for (const policy of policies) {
        if (!policy.effective_date) {
          throw new Error("Each policy must have an effective date");
        }
        // For brokered policies, require policy_type_name (free text) and carrier
        // For regular policies, require product_type_id (from dropdown)
        if (policy.isBrokered) {
          if (!policy.policy_type_name?.trim()) {
            throw new Error("Each brokered policy must have a policy type entered");
          }
          if (!policy.brokeredCarrierId) {
            throw new Error(`Policy "${policy.policy_type_name}" requires a brokered carrier`);
          }
        } else {
          if (!policy.product_type_id) {
            throw new Error("Each policy must have a policy type selected");
          }
        }
        if (policy.lineItems.length === 0) {
          throw new Error(`Policy "${policy.policy_type_name || 'Unnamed'}" must have at least one line item`);
        }
      }

      // Calculate VC totals
      const allItems = policies.flatMap((p) => p.lineItems);
      const vcItems = allItems.filter((item) => item.is_vc_qualifying);
      const vcTotals = vcItems.reduce(
        (acc, item) => ({
          items: acc.items + item.item_count,
          premium:
            acc.premium +
            (typeof item.premium === "number" ? item.premium : parseFloat(item.premium) || 0),
          points: acc.points + item.points,
        }),
        { items: 0, premium: 0, points: 0 }
      );

      // If editing, delete existing policies and items first
      if (isEditMode && editSale) {
        const { error: deleteItemsError } = await supabase
          .from("sale_items")
          .delete()
          .in(
            "sale_policy_id",
            editSale.sale_policies.map((p) => p.id)
          );
        if (deleteItemsError) throw deleteItemsError;

        const { error: deletePoliciesError } = await supabase
          .from("sale_policies")
          .delete()
          .eq("sale_id", editSale.id);
        if (deletePoliciesError) throw deletePoliciesError;
      }

      // Auto-assign to Owner if no producer selected
      let finalTeamMemberId = producerId || null;
      if (!finalTeamMemberId && profile?.agency_id) {
        const { data: ownerMember } = await supabase
          .from("team_members")
          .select("id")
          .eq("agency_id", profile.agency_id)
          .eq("role", "Owner")
          .maybeSingle();
        if (ownerMember) {
          finalTeamMemberId = ownerMember.id;
        }
      }

      // For backward compatibility, set sales.brokered_carrier_id to first brokered policy's carrier
      const firstBrokeredPolicy = policies.find(p => p.isBrokered && p.brokeredCarrierId);
      const saleLevelBrokeredCarrierId = firstBrokeredPolicy?.brokeredCarrierId || null;

      // Create or update the sale
      const saleData = {
        agency_id: profile.agency_id,
        team_member_id: finalTeamMemberId,
        lead_source_id: leadSourceId || null,
        brokered_carrier_id: saleLevelBrokeredCarrierId,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim() || null,
        customer_phone: customerPhone.trim() || null,
        customer_zip: customerZip.trim() || null,
        sale_date: format(saleDate, "yyyy-MM-dd"),
        effective_date: format(policies[0].effective_date!, "yyyy-MM-dd"),
        total_policies: policies.length,
        total_items: totals.items,
        total_premium: totals.premium,
        total_points: totals.points,
        is_vc_qualifying: vcItems.length > 0,
        vc_items: vcTotals.items,
        vc_premium: vcTotals.premium,
        vc_points: vcTotals.points,
        is_bundle: bundleInfo.isBundle,
        bundle_type: bundleInfo.bundleType,
        existing_customer_products: hasExistingPolicies ? existingPolicyTypes : [],
        source: "manual",
        created_by: user?.id,
      };

      let saleId: string;

      if (isEditMode && editSale) {
        const { error: updateError } = await supabase
          .from("sales")
          .update(saleData)
          .eq("id", editSale.id);
        if (updateError) throw updateError;
        saleId = editSale.id;
      } else {
        const { data: sale, error: saleError } = await supabase
          .from("sales")
          .insert(saleData)
          .select("id")
          .single();
        if (saleError) throw saleError;
        saleId = sale.id;
      }

      // Create policies and items
      for (const policy of policies) {
        const policyTotals = calculatePolicyTotals(policy);

        // For brokered policies, product_type_id is "brokered" - convert to null for DB
        const productTypeId = policy.product_type_id === "brokered" ? null : (policy.product_type_id || null);

        const { data: createdPolicy, error: policyError } = await supabase
          .from("sale_policies")
          .insert({
            sale_id: saleId,
            product_type_id: productTypeId,
            policy_type_name: policy.policy_type_name,
            policy_number: policy.policy_number || null,
            effective_date: format(policy.effective_date!, "yyyy-MM-dd"),
            total_items: policyTotals.items,
            total_premium: policyTotals.premium,
            total_points: policyTotals.points,
            is_vc_qualifying: policy.is_vc_qualifying,
            brokered_carrier_id: policy.isBrokered ? policy.brokeredCarrierId : null,
          })
          .select("id")
          .single();

        if (policyError) throw policyError;

        // Create line items for this policy
        const saleItems = policy.lineItems.map((item) => ({
          sale_id: saleId,
          sale_policy_id: createdPolicy.id,
          product_type_id: item.product_type_id && item.product_type_id !== "brokered" ? item.product_type_id : null,
          product_type_name: item.product_type_name,
          item_count: item.item_count,
          premium:
            typeof item.premium === "number" ? item.premium : parseFloat(item.premium) || 0,
          points: item.points,
          is_vc_qualifying: item.is_vc_qualifying,
        }));

        const { error: itemsError } = await supabase
          .from("sale_items")
          .insert(saleItems);

        if (itemsError) throw itemsError;
      }

      // Trigger sale notification email for new sales (fire and forget)
      if (!isEditMode && profile?.agency_id) {
        supabase.functions.invoke('send-sale-notification', {
          body: { 
            sale_id: saleId, 
            agency_id: profile.agency_id 
          }
        }).catch(err => {
          console.error('[AddSaleForm] Failed to trigger sale notification:', err);
        });
      }

      return { saleId };
    },
    onSuccess: async ({ saleId }) => {
      // Fetch saved sale to confirm lead_source was persisted (proof)
      const { data: savedSale } = await supabase
        .from("sales")
        .select("id, lead_source_id, lead_source:lead_sources(name)")
        .eq("id", saleId)
        .single();

      const savedLeadSourceName = savedSale?.lead_source?.name;
      console.log(`[SaleSaveProof] saleId=${saleId} lead_source_id=${savedSale?.lead_source_id} lead_source_name=${savedLeadSourceName}`);

      if (isEditMode && savedLeadSourceName) {
        toast.success(`Sale updated! Lead Source: ${savedLeadSourceName}`);
      } else {
        toast.success(isEditMode ? "Sale updated successfully!" : "Sale created successfully!");
      }

      queryClient.invalidateQueries({ queryKey: ["sales"] });
      // Invalidate sale-for-edit so next edit fetch is fresh
      queryClient.invalidateQueries({ queryKey: ["sale-for-edit"] });
      // Invalidate promo widgets so progress refreshes immediately
      queryClient.invalidateQueries({ queryKey: ["admin-promo-goals-widget"] });
      queryClient.invalidateQueries({ queryKey: ["promo-goals"] });
      queryClient.invalidateQueries({ queryKey: ["staff-promo-goals"] });

      // For new sales, show the ApplySequenceModal
      if (!isEditMode && profile?.agency_id) {
        // Save the data needed for the modal before resetting the form
        setNewSaleData({
          saleId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
        });
        setApplySequenceModalOpen(true);
        // Don't call onSuccess yet - will be called when modal closes
      } else {
        resetForm();
        onSuccess?.();
      }
    },
    onError: (error) => {
      console.error("Error saving sale:", error);
      toast.error(error.message || "Failed to save sale");
    },
  });

  const resetForm = () => {
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setCustomerZip("");
    setLeadSourceId("");
    setProducerId("");
    setSaleDate(todayLocal());
    setPolicies([]);
    setHasExistingPolicies(false);
    setExistingPolicyTypes([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSale.mutate();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6">
        {/* Section 1: Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle>{isEditMode ? "Edit Sale" : "Customer Information"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerName">
                Customer Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="John Smith"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerEmail">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customerEmail"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="john@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">
                Phone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customerPhone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(formatPhoneNumber(e.target.value))}
                placeholder="(555) 123-4567"
                maxLength={14}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerZip">Zip Code</Label>
              <Input
                id="customerZip"
                value={customerZip}
                onChange={(e) => setCustomerZip(e.target.value)}
                placeholder="12345"
                maxLength={10}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="leadSource">
                Lead Source <span className="text-destructive">*</span>
              </Label>
              {/* Show loading state if leadSources not ready but we have a saved value */}
              {leadSourcesLoading && leadSourceId ? (
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editSale?.lead_source?.name || "Loading lead sources..."}
                </div>
              ) : (
                <Select value={leadSourceId} onValueChange={setLeadSourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead source..." />
                  </SelectTrigger>
                  <SelectContent>
                    {leadSources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Existing Customer Section */}
            <div className="space-y-3 sm:col-span-2">
              <div className={cn(
                "p-4 rounded-lg border transition-colors",
                hasExistingPolicies
                  ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20"
                  : "border-muted bg-muted/30"
              )}>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="hasExistingPolicies"
                    checked={hasExistingPolicies}
                    onCheckedChange={(checked) => {
                      setHasExistingPolicies(checked === true);
                      if (!checked) {
                        setExistingPolicyTypes([]);
                      }
                    }}
                  />
                  <Label
                    htmlFor="hasExistingPolicies"
                    className="flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Customer has existing policies with us
                  </Label>
                </div>

                {hasExistingPolicies && (
                  <div className="mt-4 pl-7 space-y-3">
                    <Label className="text-sm text-muted-foreground">
                      What products do they already have?
                    </Label>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="existingAuto"
                          checked={existingPolicyTypes.includes('auto')}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setExistingPolicyTypes([...existingPolicyTypes, 'auto']);
                            } else {
                              setExistingPolicyTypes(existingPolicyTypes.filter(t => t !== 'auto'));
                            }
                          }}
                        />
                        <Label htmlFor="existingAuto" className="cursor-pointer">
                          Auto
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="existingHome"
                          checked={existingPolicyTypes.includes('home')}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setExistingPolicyTypes([...existingPolicyTypes, 'home']);
                            } else {
                              setExistingPolicyTypes(existingPolicyTypes.filter(t => t !== 'home'));
                            }
                          }}
                        />
                        <Label htmlFor="existingHome" className="cursor-pointer">
                          Home/Property
                        </Label>
                      </div>
                    </div>

                    {/* Bundle Type Preview */}
                    {policies.length > 0 && existingPolicyTypes.length > 0 && (
                      <div className="mt-3 p-2 rounded bg-blue-100 dark:bg-blue-900/30 text-sm">
                        {bundleInfo.bundleType === 'Preferred' ? (
                          <span className="text-blue-700 dark:text-blue-300">
                            → Adding {policies.map(p => p.policy_type_name).filter(Boolean).join(', ') || 'this policy'} = <strong>Preferred Bundle</strong>
                          </span>
                        ) : bundleInfo.bundleType === 'Standard' ? (
                          <span className="text-blue-700 dark:text-blue-300">
                            → Adding {policies.map(p => p.policy_type_name).filter(Boolean).join(', ') || 'this policy'} = <strong>Standard Bundle</strong>
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Producer & Date */}
        <Card>
          <CardHeader>
            <CardTitle>Producer & Date</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="producer">Producer</Label>
              <Select value={producerId} onValueChange={setProducerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select producer" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Sale Date <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !saleDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {saleDate ? format(saleDate, "MMM d, yyyy") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={saleDate} onSelect={(d) => setSaleDate(toLocalDate(d))} />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Policies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Policies</span>
              <Button type="button" variant="outline" size="sm" onClick={addPolicy}>
                <Plus className="h-4 w-4 mr-1" />
                Add Policy
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {policies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No policies added yet. Click "Add Policy" to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {policies.map((policy, policyIndex) => {
                  const policyTotals = calculatePolicyTotals(policy);
                  return (
                    <Collapsible
                      key={policy.id}
                      open={policy.isExpanded}
                      onOpenChange={() => togglePolicyExpand(policy.id)}
                    >
                      <div className="border rounded-lg">
                        {/* Policy Header */}
                        <div className={cn(
                          "flex items-center justify-between p-4",
                          policy.isBrokered
                            ? "bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800"
                            : "bg-muted/30"
                        )}>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-2">
                              {policy.isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span className="font-medium">
                                Policy {policyIndex + 1}
                                {policy.policy_type_name && `: ${policy.policy_type_name}`}
                              </span>
                              {policy.isBrokered && (
                                <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 ml-2">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  Brokered
                                </Badge>
                              )}
                              {policy.is_vc_qualifying && (
                                <Badge variant="default" className="bg-green-600 ml-2">
                                  VC
                                </Badge>
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <div className="flex items-center gap-4">
                            <div className="text-sm text-muted-foreground">
                              {policyTotals.items} items · ${policyTotals.premium.toLocaleString()} · {policyTotals.points} pts
                            </div>
                            {/* Brokered Toggle */}
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`brokered-${policy.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                Brokered
                              </Label>
                              <Switch
                                id={`brokered-${policy.id}`}
                                checked={policy.isBrokered}
                                onCheckedChange={(checked) => {
                                  setPolicies(policies.map((p) => {
                                    if (p.id !== policy.id) return p;
                                    if (checked) {
                                      // Switching to brokered - clear product_type_id, keep premium/points if exists
                                      return {
                                        ...p,
                                        isBrokered: true,
                                        product_type_id: "brokered",
                                        is_vc_qualifying: false,
                                        lineItems: p.lineItems.length > 0 ? [{
                                          ...p.lineItems[0],
                                          product_type_id: "",  // Clear since this is now brokered
                                          product_type_name: p.policy_type_name || "",
                                          is_vc_qualifying: false,
                                        }] : [{
                                          id: crypto.randomUUID(),
                                          product_type_id: "",
                                          product_type_name: p.policy_type_name || "",
                                          item_count: 1,
                                          premium: 0,
                                          points: 0,
                                          is_vc_qualifying: false,
                                        }],
                                      };
                                    } else {
                                      // Switching from brokered - clear brokered fields
                                      return {
                                        ...p,
                                        isBrokered: false,
                                        brokeredCarrierId: null,
                                        product_type_id: "",
                                        policy_type_name: "",
                                        lineItems: [],
                                      };
                                    }
                                  }));
                                }}
                                className={cn(
                                  "data-[state=checked]:bg-amber-500"
                                )}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removePolicy(policy.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        {/* Policy Content */}
                        <CollapsibleContent>
                          <div className="p-4 space-y-4">
                            {/* Brokered Carrier Selector - shown when policy is brokered */}
                            {policy.isBrokered && (
                              <div className="p-3 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10">
                                <div className="space-y-2">
                                  <Label>
                                    Brokered Carrier <span className="text-destructive">*</span>
                                  </Label>
                                  {brokeredCarriers.length > 0 ? (
                                    <Select
                                      value={policy.brokeredCarrierId || ""}
                                      onValueChange={(value) => {
                                        setPolicies(policies.map((p) =>
                                          p.id === policy.id
                                            ? { ...p, brokeredCarrierId: value || null }
                                            : p
                                        ));
                                      }}
                                    >
                                      <SelectTrigger className={cn(
                                        !policy.brokeredCarrierId && "border-amber-500"
                                      )}>
                                        <SelectValue placeholder="Choose a brokered carrier..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {brokeredCarriers.map((carrier) => (
                                          <SelectItem key={carrier.id} value={carrier.id}>
                                            {carrier.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <div className="flex items-center gap-2 p-3 rounded-md bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                                      <span className="text-sm text-amber-800 dark:text-amber-200">
                                        No brokered carriers configured.
                                      </span>
                                      <a
                                        href="/agency?tab=settings"
                                        className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline inline-flex items-center gap-1"
                                      >
                                        Set up carriers
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Policy Fields */}
                            <div className="grid gap-4 sm:grid-cols-3">
                              <div className="space-y-2">
                                <Label>
                                  Policy Type <span className="text-destructive">*</span>
                                </Label>
                                {policy.isBrokered ? (
                                  <Input
                                    value={policy.policy_type_name}
                                    onChange={(e) => {
                                      const newName = e.target.value;
                                      // Update policies with both policy_type_name and auto-create line item
                                      setPolicies(policies.map((pol) => {
                                        if (pol.id !== policy.id) return pol;
                                        const lineItem = pol.lineItems.length > 0
                                          ? { ...pol.lineItems[0], product_type_name: newName }
                                          : {
                                              id: crypto.randomUUID(),
                                              product_type_id: "",
                                              product_type_name: newName,
                                              item_count: 1,
                                              premium: 0,
                                              points: 0,
                                              is_vc_qualifying: false,
                                            };
                                        return {
                                          ...pol,
                                          policy_type_name: newName,
                                          product_type_id: "brokered",
                                          is_vc_qualifying: false,
                                          lineItems: [lineItem],
                                        };
                                      }));
                                    }}
                                    placeholder="e.g., Wind Only, Flood, etc."
                                  />
                                ) : (
                                  <Select
                                    value={policy.product_type_id}
                                    onValueChange={(value) =>
                                      updatePolicy(policy.id, "product_type_id", value)
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select policy type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {productTypes.map((product) => (
                                        <SelectItem key={product.id} value={product.id}>
                                          {product.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Policy Number</Label>
                                <Input
                                  value={policy.policy_number}
                                  onChange={(e) =>
                                    updatePolicy(policy.id, "policy_number", e.target.value)
                                  }
                                  placeholder="POL-12345"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>
                                  Effective Date <span className="text-destructive">*</span>
                                </Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !policy.effective_date && "text-muted-foreground"
                                      )}
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {policy.effective_date
                                        ? format(policy.effective_date, "MMM d, yyyy")
                                        : "Pick a date"}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={policy.effective_date}
                                      onSelect={(date) =>
                                        updatePolicy(policy.id, "effective_date", toLocalDate(date))
                                      }
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>

                            {/* Conditional rendering based on product type */}
                            {isMultiItemProduct(policy.policy_type_name) ? (
                              /* Multi-item products: Full line items interface */
                              <>
                                {/* Line Items Header */}
                                <div className="flex items-center justify-between mt-4">
                                  <Label className="text-sm font-medium">Line Items</Label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addLineItem(policy.id)}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Item
                                  </Button>
                                </div>

                                {/* Line Items */}
                                {policy.lineItems.length === 0 ? (
                                  <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg">
                                    No items yet. Click "Add Item" to add line items.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {policy.lineItems.map((item, itemIndex) => (
                                      <div
                                        key={item.id}
                                        className="grid gap-3 p-3 border rounded-lg sm:grid-cols-4 items-end bg-muted/10"
                                      >
                                        <div className="space-y-1">
                                          <Label className="text-xs">Item #{itemIndex + 1}</Label>
                                          <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm">
                                            {policy.policy_type_name}
                                          </div>
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Count</Label>
                                          <Input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            className="h-9"
                                            value={item.item_count === 0 ? "" : item.item_count}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (val === "" || /^\d+$/.test(val)) {
                                                updateLineItem(
                                                  policy.id,
                                                  item.id,
                                                  "item_count",
                                                  val === "" ? 0 : parseInt(val)
                                                );
                                              }
                                            }}
                                            onBlur={(e) => {
                                              if (e.target.value === "" || parseInt(e.target.value) < 1) {
                                                updateLineItem(policy.id, item.id, "item_count", 1);
                                              }
                                            }}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Premium ($)</Label>
                                          <Input
                                            type="text"
                                            inputMode="decimal"
                                            className="h-9"
                                            value={item.premium === 0 ? "" : item.premium}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              // Allow empty, digits, and decimals
                                              if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                                updateLineItem(
                                                  policy.id,
                                                  item.id,
                                                  "premium",
                                                  val === "" ? 0 : (val as any)
                                                );
                                              }
                                            }}
                                            onBlur={(e) => {
                                              // Clean up on blur - ensure it's a valid number
                                              const parsed = parseFloat(e.target.value) || 0;
                                              updateLineItem(policy.id, item.id, "premium", parsed);
                                            }}
                                            placeholder="0.00"
                                          />
                                        </div>
                                        <div className="flex items-end gap-2">
                                          <div className="flex-1 space-y-1">
                                            <Label className="text-xs">Points</Label>
                                            <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm">
                                              {item.points}
                                            </div>
                                          </div>
                                          {item.is_vc_qualifying && (
                                            <Badge variant="default" className="bg-green-600 h-9">
                                              VC
                                            </Badge>
                                          )}
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => removeLineItem(policy.id, item.id)}
                                          >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : policy.isBrokered && policy.policy_type_name ? (
                              /* Brokered business: Simplified interface with editable items */
                              <div className="grid gap-4 mt-4 sm:grid-cols-4 items-end">
                                <div className="space-y-1">
                                  <Label className="text-xs">Items</Label>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="h-9"
                                    value={policy.lineItems[0]?.item_count === 0 ? "" : policy.lineItems[0]?.item_count}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === "" || /^\d+$/.test(val)) {
                                        if (policy.lineItems[0]) {
                                          updateLineItem(
                                            policy.id,
                                            policy.lineItems[0].id,
                                            "item_count",
                                            val === "" ? 0 : parseInt(val)
                                          );
                                        }
                                      }
                                    }}
                                    onBlur={(e) => {
                                      if (policy.lineItems[0] && (e.target.value === "" || parseInt(e.target.value) < 1)) {
                                        updateLineItem(policy.id, policy.lineItems[0].id, "item_count", 1);
                                      }
                                    }}
                                    placeholder="1"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Premium ($)</Label>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    className="h-9"
                                    value={
                                      policy.lineItems[0]?.premium === 0
                                        ? ""
                                        : (policy.lineItems[0]?.premium ?? "")
                                    }
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                        if (policy.lineItems[0]) {
                                          updateLineItem(
                                            policy.id,
                                            policy.lineItems[0].id,
                                            "premium",
                                            val === "" ? 0 : (val as any)
                                          );
                                        }
                                      }
                                    }}
                                    onBlur={(e) => {
                                      if (policy.lineItems[0]) {
                                        const parsed = parseFloat(e.target.value) || 0;
                                        updateLineItem(
                                          policy.id,
                                          policy.lineItems[0].id,
                                          "premium",
                                          parsed
                                        );
                                      }
                                    }}
                                    placeholder="0.00"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Points</Label>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="h-9"
                                    value={policy.lineItems[0]?.points === 0 ? "" : policy.lineItems[0]?.points}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === "" || /^\d+$/.test(val)) {
                                        if (policy.lineItems[0]) {
                                          updateLineItem(
                                            policy.id,
                                            policy.lineItems[0].id,
                                            "points",
                                            val === "" ? 0 : parseInt(val)
                                          );
                                        }
                                      }
                                    }}
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                            ) : policy.policy_type_name ? (
                              /* Single-item products: Simplified interface */
                              <div className="grid gap-4 mt-4 sm:grid-cols-3 items-end">
                                <div className="space-y-1">
                                  <Label className="text-xs">Premium ($)</Label>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    className="h-9"
                                    value={
                                      policy.lineItems[0]?.premium === 0
                                        ? ""
                                        : (policy.lineItems[0]?.premium ?? "")
                                    }
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      // Allow empty, digits, and decimals
                                      if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                        if (policy.lineItems[0]) {
                                          updateLineItem(
                                            policy.id,
                                            policy.lineItems[0].id,
                                            "premium",
                                            val === "" ? 0 : (val as any)
                                          );
                                        }
                                      }
                                    }}
                                    onBlur={(e) => {
                                      // Clean up on blur - ensure it's a valid number
                                      if (policy.lineItems[0]) {
                                        const parsed = parseFloat(e.target.value) || 0;
                                        updateLineItem(
                                          policy.id,
                                          policy.lineItems[0].id,
                                          "premium",
                                          parsed
                                        );
                                      }
                                    }}
                                    placeholder="0.00"
                                  />
                                </div>
                                <div className="flex items-end gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Points</Label>
                                    <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm min-w-[60px]">
                                      {policy.lineItems[0]?.points || 0}
                                    </div>
                                  </div>
                                  {policy.is_vc_qualifying && (
                                    <Badge variant="default" className="bg-green-600 h-9">
                                      VC
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* No product type selected yet */
                              <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg mt-4">
                                {policy.isBrokered ? "Enter a policy type to add details." : "Select a policy type to add details."}
                              </div>
                            )}

                            {/* Policy Subtotals - only show for multi-item products with items */}
                            {isMultiItemProduct(policy.policy_type_name) && policy.lineItems.length > 0 && (
                              <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg mt-4">
                                <div className="text-center">
                                  <div className="font-semibold">{policyTotals.items}</div>
                                  <div className="text-xs text-muted-foreground">Items</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-semibold">
                                    ${policyTotals.premium.toLocaleString()}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Premium</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-semibold">{policyTotals.points}</div>
                                  <div className="text-xs text-muted-foreground">Points</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Sale Summary */}
        {policies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                Sale Summary
                {bundleInfo.isBundle && bundleInfo.bundleType === 'Preferred' && (
                  <Badge variant="default" className="bg-blue-600 text-slate-900">
                    Preferred Bundle
                  </Badge>
                )}
                {bundleInfo.isBundle && bundleInfo.bundleType === 'Standard' && (
                  <Badge variant="secondary">
                    Standard Bundle
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Totals */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold">{policies.length}</div>
                  <div className="text-sm text-muted-foreground">Policies</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{totals.items}</div>
                  <div className="text-sm text-muted-foreground">Total Items</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    ${totals.premium.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Premium</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{totals.points}</div>
                  <div className="text-sm text-muted-foreground">Total Points</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 5: Actions */}
        <div className="flex justify-end gap-4">
          {isEditMode && onCancelEdit && (
            <Button type="button" variant="outline" onClick={onCancelEdit}>
              Cancel
            </Button>
          )}
          <Button type="button" variant="outline" onClick={resetForm}>
            Clear Form
          </Button>
          <Button
            type="submit"
            disabled={
              saveSale.isPending ||
              !customerName.trim() ||
              !saleDate ||
              policies.length === 0
            }
          >
            {saveSale.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditMode ? "Update Sale" : "Create Sale"}
          </Button>
        </div>
      </div>

      {/* Apply Sequence Modal - shown after new sale creation */}
      {newSaleData && profile?.agency_id && (
        <ApplySequenceModal
          open={applySequenceModalOpen}
          onOpenChange={(open) => {
            setApplySequenceModalOpen(open);
            if (!open) {
              // Modal closed - clean up and call onSuccess
              setNewSaleData(null);
              resetForm();
              onSuccess?.();
            }
          }}
          saleId={newSaleData.saleId}
          customerName={newSaleData.customerName}
          customerPhone={newSaleData.customerPhone}
          customerEmail={newSaleData.customerEmail}
          agencyId={profile.agency_id}
          onSuccess={() => {
            // Sequence was applied or skipped
            setNewSaleData(null);
            setApplySequenceModalOpen(false);
            resetForm();
            onSuccess?.();
          }}
        />
      )}
    </form>
  );
}
