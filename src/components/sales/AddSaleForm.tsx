import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  premium: number;
  points: number;
  is_vc_qualifying: boolean;
};

interface AddSaleFormProps {
  onSuccess?: () => void;
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

// Helper to determine if a product is "Auto" type
const isAutoProduct = (name: string) => {
  const lower = name.toLowerCase();
  return lower.includes("auto");
};

// Helper to determine if a product is "Home" type (Home, Condo, Landlord)
const isHomeProduct = (name: string) => {
  const lower = name.toLowerCase();
  return (
    lower.includes("homeowner") ||
    lower.includes("condo") ||
    lower.includes("landlord")
  );
};

export function AddSaleForm({ onSuccess }: AddSaleFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerZip, setCustomerZip] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [effectiveDate, setEffectiveDate] = useState<Date | undefined>(
    new Date()
  );
  const [producerId, setProducerId] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isBundle, setIsBundle] = useState(false);
  const [bundleType, setBundleType] = useState<string>("");

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

  // Calculate totals
  const totals = useMemo(() => {
    return lineItems.reduce(
      (acc, item) => ({
        items: acc.items + item.item_count,
        premium: acc.premium + item.premium,
        points: acc.points + item.points,
      }),
      { items: 0, premium: 0, points: 0 }
    );
  }, [lineItems]);

  // Detect if bundle is possible (has both Auto and Home products)
  const canBundle = useMemo(() => {
    const hasAuto = lineItems.some((item) => isAutoProduct(item.product_type_name));
    const hasHome = lineItems.some((item) => isHomeProduct(item.product_type_name));
    return hasAuto && hasHome;
  }, [lineItems]);

  // Add a new line item
  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: crypto.randomUUID(),
        product_type_id: "",
        product_type_name: "",
        item_count: 1,
        premium: 0,
        points: 0,
        is_vc_qualifying: false,
      },
    ]);
  };

  // Remove a line item
  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  // Update a line item
  const updateLineItem = (
    id: string,
    field: keyof LineItem,
    value: string | number | boolean
  ) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // If product type changed, update points and VC status
        if (field === "product_type_id") {
          const product = productTypes.find((p) => p.id === value);
          if (product) {
            updated.product_type_name = product.name;
            updated.points = (product.default_points || 0) * updated.item_count;
            updated.is_vc_qualifying = product.is_vc_item || false;
          }
        }

        // If item count changed, recalculate points
        if (field === "item_count") {
          const product = productTypes.find(
            (p) => p.id === updated.product_type_id
          );
          if (product) {
            updated.points = (product.default_points || 0) * (value as number);
          }
        }

        return updated;
      })
    );
  };

  // Create sale mutation
  const createSale = useMutation({
    mutationFn: async () => {
      if (!profile?.agency_id) throw new Error("No agency found");
      if (!effectiveDate) throw new Error("Effective date is required");
      if (!customerName.trim()) throw new Error("Customer name is required");
      if (lineItems.length === 0) throw new Error("At least one line item is required");

      // Calculate VC totals
      const vcItems = lineItems.filter((item) => item.is_vc_qualifying);
      const vcTotals = vcItems.reduce(
        (acc, item) => ({
          items: acc.items + item.item_count,
          premium: acc.premium + item.premium,
          points: acc.points + item.points,
        }),
        { items: 0, premium: 0, points: 0 }
      );

      // Create the sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          agency_id: profile.agency_id,
          team_member_id: producerId || null,
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim() || null,
          customer_phone: customerPhone.trim() || null,
          customer_zip: customerZip.trim() || null,
          policy_number: policyNumber.trim() || null,
          effective_date: format(effectiveDate, "yyyy-MM-dd"),
          sale_date: format(effectiveDate, "yyyy-MM-dd"),
          total_items: totals.items,
          total_premium: totals.premium,
          total_points: totals.points,
          is_vc_qualifying: vcItems.length > 0,
          vc_items: vcTotals.items,
          vc_premium: vcTotals.premium,
          vc_points: vcTotals.points,
          is_bundle: canBundle && isBundle,
          bundle_type: canBundle && isBundle ? bundleType : null,
          source: "manual",
          created_by: user?.id,
        })
        .select("id")
        .single();

      if (saleError) throw saleError;

      // Create line items
      const saleItems = lineItems.map((item) => ({
        sale_id: sale.id,
        product_type_id: item.product_type_id || null,
        product_type_name: item.product_type_name,
        item_count: item.item_count,
        premium: item.premium,
        points: item.points,
        is_vc_qualifying: item.is_vc_qualifying,
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);

      if (itemsError) throw itemsError;

      return sale;
    },
    onSuccess: () => {
      toast.success("Sale created successfully!");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      resetForm();
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Error creating sale:", error);
      toast.error(error.message || "Failed to create sale");
    },
  });

  const resetForm = () => {
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setCustomerZip("");
    setPolicyNumber("");
    setEffectiveDate(new Date());
    setProducerId("");
    setLineItems([]);
    setIsBundle(false);
    setBundleType("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSale.mutate();
  };

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
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Policy Info */}
        <Card>
          <CardHeader>
            <CardTitle>Policy Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="policyNumber">Policy Number</Label>
              <Input
                id="policyNumber"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
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
                      !effectiveDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {effectiveDate ? (
                      format(effectiveDate, "MMM d, yyyy")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={effectiveDate}
                    onSelect={setEffectiveDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
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
          </CardContent>
        </Card>

        {/* Section 3: Line Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Line Items</span>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lineItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No items added yet. Click "Add Item" to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {lineItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid gap-4 p-4 border rounded-lg sm:grid-cols-4 items-end"
                  >
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Product Type</Label>
                      <Select
                        value={item.product_type_id}
                        onValueChange={(value) =>
                          updateLineItem(item.id, "product_type_id", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {productTypes.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} ({product.default_points || 0} pts)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Item Count</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.item_count}
                        onChange={(e) =>
                          updateLineItem(
                            item.id,
                            "item_count",
                            parseInt(e.target.value) || 1
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Premium ($)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.premium}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "premium",
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(item.id)}
                          className="shrink-0"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground sm:col-span-4 flex gap-4">
                      <span>Points: {item.points}</span>
                      {item.is_vc_qualifying && (
                        <span className="text-green-600">VC Qualifying</span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Totals */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg mt-4">
                  <div className="text-center">
                    <div className="text-xl font-bold">{totals.items}</div>
                    <div className="text-sm text-muted-foreground">
                      Total Items
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold">
                      ${totals.premium.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Premium
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold">{totals.points}</div>
                    <div className="text-sm text-muted-foreground">
                      Total Points
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Bundle Detection */}
        {canBundle && (
          <Card>
            <CardHeader>
              <CardTitle>Bundle Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isBundle"
                  checked={isBundle}
                  onCheckedChange={(checked) => setIsBundle(checked as boolean)}
                />
                <Label htmlFor="isBundle">This is a bundle</Label>
              </div>
              {isBundle && (
                <div className="space-y-2">
                  <Label>Bundle Type</Label>
                  <Select value={bundleType} onValueChange={setBundleType}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Preferred">Preferred</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={resetForm}>
            Clear Form
          </Button>
          <Button
            type="submit"
            disabled={
              createSale.isPending ||
              !customerName.trim() ||
              !effectiveDate ||
              lineItems.length === 0
            }
          >
            {createSale.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Create Sale
          </Button>
        </div>
      </div>
    </form>
  );
}
