import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { CalendarIcon, Plus, Trash2, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type ProductType = {
  id: string;
  name: string;
  category: string;
  default_points: number | null;
  is_vc_item: boolean | null;
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
};

interface StaffAddSaleFormProps {
  onSuccess?: () => void;
  agencyId?: string;
  staffSessionToken?: string;
  staffTeamMemberId?: string | null;
}

// Format phone number as (XXX) XXX-XXXX
const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  const limited = digits.slice(0, 10);
  
  if (limited.length === 0) return '';
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
};

// Auto products for Preferred Bundle detection
const AUTO_PRODUCTS = ['Standard Auto', 'Non-Standard Auto', 'Specialty Auto'];
const HOME_PRODUCTS = ['Homeowners', 'North Light Homeowners', 'Condo', 'North Light Condo'];

// Helper to detect bundle type automatically
const detectBundleType = (policies: Policy[]): { isBundle: boolean; bundleType: string | null } => {
  const productNames = policies.map(p => p.policy_type_name).filter(Boolean);
  
  const hasAuto = productNames.some(name => 
    AUTO_PRODUCTS.some(auto => name.toLowerCase() === auto.toLowerCase())
  );
  const hasHome = productNames.some(name => 
    HOME_PRODUCTS.some(home => name.toLowerCase() === home.toLowerCase())
  );
  
  if (hasAuto && hasHome) {
    return { isBundle: true, bundleType: 'Preferred' };
  }
  
  if (policies.filter(p => p.policy_type_name).length > 1) {
    return { isBundle: true, bundleType: 'Standard' };
  }
  
  return { isBundle: false, bundleType: null };
};

// Multi-item product types
const MULTI_ITEM_PRODUCTS = ["Standard Auto", "Specialty Auto", "Boatowners"];

const isMultiItemProduct = (productName: string): boolean => {
  return MULTI_ITEM_PRODUCTS.some(
    (name) => productName.toLowerCase() === name.toLowerCase()
  );
};

export function StaffAddSaleForm({ onSuccess, agencyId, staffSessionToken, staffTeamMemberId }: StaffAddSaleFormProps) {
  const queryClient = useQueryClient();

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerZip, setCustomerZip] = useState("");
  const [saleDate, setSaleDate] = useState<Date | undefined>(new Date());
  const [policies, setPolicies] = useState<Policy[]>([]);

  // Fetch product types
  const { data: productTypes = [] } = useQuery<ProductType[]>({
    queryKey: ["product-types", agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_types")
        .select("id, name, category, default_points, is_vc_item")
        .or(`agency_id.is.null,agency_id.eq.${agencyId}`)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId,
  });

  // Calculate bundle info
  const bundleInfo = useMemo(() => detectBundleType(policies), [policies]);

  // Calculate totals
  const totals = useMemo(() => {
    const allItems = policies.flatMap((p) => p.lineItems);
    return allItems.reduce(
      (acc, item) => ({
        items: acc.items + item.item_count,
        premium:
          acc.premium +
          (typeof item.premium === "number" ? item.premium : parseFloat(item.premium) || 0),
        points: acc.points + item.points,
      }),
      { items: 0, premium: 0, points: 0 }
    );
  }, [policies]);

  // Policy management functions
  const addPolicy = () => {
    setPolicies([
      ...policies,
      {
        id: crypto.randomUUID(),
        product_type_id: "",
        policy_type_name: "",
        policy_number: "",
        effective_date: saleDate,
        is_vc_qualifying: false,
        lineItems: [],
        isExpanded: true,
      },
    ]);
  };

  const removePolicy = (policyId: string) => {
    setPolicies(policies.filter((p) => p.id !== policyId));
  };

  const togglePolicyExpand = (policyId: string) => {
    setPolicies(
      policies.map((p) =>
        p.id === policyId ? { ...p, isExpanded: !p.isExpanded } : p
      )
    );
  };

  const updatePolicy = (
    policyId: string,
    field: keyof Policy,
    value: any
  ) => {
    setPolicies(
      policies.map((p) => {
        if (p.id !== policyId) return p;

        if (field === "product_type_id") {
          const selectedProduct = productTypes.find((pt) => pt.id === value);
          if (!selectedProduct) return p;

          const isVc = selectedProduct.is_vc_item || false;
          const defaultPoints = selectedProduct.default_points || 0;

          // For non-multi-item products, auto-create a single line item
          let lineItems = p.lineItems;
          if (!isMultiItemProduct(selectedProduct.name)) {
            // Create or update single line item
            lineItems = [{
              id: p.lineItems[0]?.id || crypto.randomUUID(),
              product_type_id: selectedProduct.id,
              product_type_name: selectedProduct.name,
              item_count: 1,
              premium: p.lineItems[0]?.premium || 0,
              points: defaultPoints,
              is_vc_qualifying: isVc,
            }];
          } else if (p.lineItems.length === 0) {
            // For multi-item, start with empty line items
            lineItems = [];
          }

          return {
            ...p,
            product_type_id: value,
            policy_type_name: selectedProduct.name,
            is_vc_qualifying: isVc,
            lineItems,
          };
        }

        return { ...p, [field]: value };
      })
    );
  };

  // Line item management
  const addLineItem = (policyId: string) => {
    setPolicies(
      policies.map((p) => {
        if (p.id !== policyId) return p;

        const selectedProduct = productTypes.find(
          (pt) => pt.id === p.product_type_id
        );
        if (!selectedProduct) return p;

        return {
          ...p,
          lineItems: [
            ...p.lineItems,
            {
              id: crypto.randomUUID(),
              product_type_id: selectedProduct.id,
              product_type_name: selectedProduct.name,
              item_count: 1,
              premium: 0,
              points: selectedProduct.default_points || 0,
              is_vc_qualifying: selectedProduct.is_vc_item || false,
            },
          ],
        };
      })
    );
  };

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

  const updateLineItem = (
    policyId: string,
    itemId: string,
    field: keyof LineItem,
    value: any
  ) => {
    setPolicies(
      policies.map((p) => {
        if (p.id !== policyId) return p;
        return {
          ...p,
          lineItems: p.lineItems.map((item) => {
            if (item.id !== itemId) return item;

            const updatedItem = { ...item, [field]: value };

            // Recalculate points when item_count changes
            if (field === "item_count") {
              const product = productTypes.find(
                (pt) => pt.id === item.product_type_id
              );
              updatedItem.points = (product?.default_points || 0) * (value || 0);
            }

            return updatedItem;
          }),
        };
      })
    );
  };

  const calculatePolicyTotals = (policy: Policy) => {
    return policy.lineItems.reduce(
      (acc, item) => ({
        items: acc.items + item.item_count,
        premium:
          acc.premium +
          (typeof item.premium === "number"
            ? item.premium
            : parseFloat(item.premium) || 0),
        points: acc.points + item.points,
      }),
      { items: 0, premium: 0, points: 0 }
    );
  };

  // Save sale mutation using edge function
  const saveSale = useMutation({
    mutationFn: async () => {
      if (!agencyId) throw new Error("No agency found");
      if (!saleDate) throw new Error("Sale date is required");
      if (!customerName.trim()) throw new Error("Customer name is required");
      if (policies.length === 0) throw new Error("At least one policy is required");
      if (!staffSessionToken) throw new Error("Staff session required");

      // Validate each policy
      for (const policy of policies) {
        if (!policy.effective_date) {
          throw new Error("Each policy must have an effective date");
        }
        if (!policy.product_type_id) {
          throw new Error("Each policy must have a policy type selected");
        }
        if (policy.lineItems.length === 0) {
          throw new Error(`Policy "${policy.policy_type_name}" must have at least one line item`);
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

      const salePayload = {
        customer_name: customerName.trim(),
        customer_email: customerEmail || undefined,
        customer_phone: customerPhone || undefined,
        customer_zip: customerZip || undefined,
        sale_date: format(saleDate, "yyyy-MM-dd"),
        effective_date: format(policies[0].effective_date!, "yyyy-MM-dd"),
        source: "manual",
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
        policies: policies.map((policy) => ({
          product_type_id: policy.product_type_id || null,
          policy_type_name: policy.policy_type_name,
          policy_number: policy.policy_number || undefined,
          effective_date: format(policy.effective_date!, "yyyy-MM-dd"),
          is_vc_qualifying: policy.is_vc_qualifying,
          items: policy.lineItems.map((item) => ({
            product_type_id: item.product_type_id || null,
            product_type_name: item.product_type_name,
            item_count: item.item_count,
            premium: typeof item.premium === "number" ? item.premium : parseFloat(item.premium) || 0,
            points: item.points,
            is_vc_qualifying: item.is_vc_qualifying,
          })),
        })),
      };

      const { data, error } = await supabase.functions.invoke("create_staff_sale", {
        headers: { "x-staff-session": staffSessionToken },
        body: salePayload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      toast.success("Sale created successfully!");
      queryClient.invalidateQueries({ queryKey: ["staff-sales"] });
      resetForm();
      onSuccess?.();
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
    setSaleDate(new Date());
    setPolicies([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSale.mutate();
  };

  if (!staffTeamMemberId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Your account is not linked to a team member. Please contact your administrator.
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6">
        {/* Section 1: Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
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
              <Label htmlFor="customerEmail">Email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Phone</Label>
              <Input
                id="customerPhone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(formatPhoneNumber(e.target.value))}
                placeholder="(555) 123-4567"
                maxLength={14}
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
          </CardContent>
        </Card>

        {/* Section 2: Date */}
        <Card>
          <CardHeader>
            <CardTitle>Sale Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-xs">
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
                  <Calendar mode="single" selected={saleDate} onSelect={setSaleDate} />
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
                        <div className="flex items-center justify-between p-4 bg-muted/30">
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
                            {/* Policy Fields */}
                            <div className="grid gap-4 sm:grid-cols-3">
                              <div className="space-y-2">
                                <Label>
                                  Policy Type <span className="text-destructive">*</span>
                                </Label>
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
                                        updatePolicy(policy.id, "effective_date", date)
                                      }
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>

                            {/* Line Items for multi-item products */}
                            {isMultiItemProduct(policy.policy_type_name) ? (
                              <>
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
                              <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg mt-4">
                                Select a policy type to add details.
                              </div>
                            )}

                            {/* Policy Subtotals */}
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
                  <Badge variant="default" className="bg-blue-600">
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
            Create Sale
          </Button>
        </div>
      </div>
    </form>
  );
}
