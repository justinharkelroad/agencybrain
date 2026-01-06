import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

interface SalePolicy {
  id: string;
  policy_type_name: string | null;
  policy_number: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
}

interface Sale {
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
  sale_policies?: SalePolicy[];
}

interface PolicyEdit {
  id: string;
  policy_type_name: string | null;
  policy_number: string | null;
  total_premium: string;
  total_items: string;
  total_points: number | null;
  markedForDeletion: boolean;
}

interface StaffEditSaleModalProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionToken: string;
  leadSources?: { id: string; name: string }[];
}

export function StaffEditSaleModal({
  sale,
  open,
  onOpenChange,
  sessionToken,
  leadSources = [],
}: StaffEditSaleModalProps) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [formData, setFormData] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    customer_zip: "",
    sale_date: "",
    lead_source_id: "",
  });
  const [policies, setPolicies] = useState<PolicyEdit[]>([]);

  // Load full sale details (including policy premium/items) when modal opens.
  useEffect(() => {
    const run = async () => {
      if (!sale?.id || !open) return;

      setIsLoadingDetails(true);
      try {
        const { data, error } = await supabase.functions.invoke("get_staff_sale_details", {
          headers: { "x-staff-session": sessionToken },
          body: { sale_id: sale.id },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const fullSale = (data?.sale || sale) as Sale;

        setFormData({
          customer_name: fullSale.customer_name || "",
          customer_email: fullSale.customer_email || "",
          customer_phone: fullSale.customer_phone || "",
          customer_zip: fullSale.customer_zip || "",
          sale_date: fullSale.sale_date || "",
          lead_source_id: fullSale.lead_source_id || "",
        });

        setPolicies(
          (fullSale.sale_policies || []).map((p) => ({
            id: p.id,
            policy_type_name: p.policy_type_name,
            policy_number: p.policy_number,
            total_premium: (p.total_premium ?? 0).toString(),
            total_items: (p.total_items ?? 0).toString(),
            total_points: p.total_points,
            markedForDeletion: false,
          }))
        );
      } catch (err: any) {
        console.error("Failed to load sale details:", err);
        toast.error(err?.message || "Failed to load sale details");

        // Fallback: at least show whatever we have
        setFormData({
          customer_name: sale.customer_name || "",
          customer_email: sale.customer_email || "",
          customer_phone: sale.customer_phone || "",
          customer_zip: sale.customer_zip || "",
          sale_date: sale.sale_date || "",
          lead_source_id: sale.lead_source_id || "",
        });

        setPolicies(
          (sale.sale_policies || []).map((p) => ({
            id: p.id,
            policy_type_name: p.policy_type_name,
            policy_number: (p as any).policy_number ?? null,
            total_premium: ((p as any).total_premium ?? 0).toString(),
            total_items: ((p as any).total_items ?? 0).toString(),
            total_points: (p as any).total_points ?? null,
            markedForDeletion: false,
          }))
        );
      } finally {
        setIsLoadingDetails(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale?.id, open, sessionToken]);

  const handlePolicyChange = (
    policyId: string,
    field: "total_premium" | "total_items",
    value: string
  ) => {
    setPolicies((prev) =>
      prev.map((p) => (p.id === policyId ? { ...p, [field]: value } : p))
    );
  };

  const toggleDeletePolicy = (policyId: string) => {
    setPolicies((prev) =>
      prev.map((p) =>
        p.id === policyId ? { ...p, markedForDeletion: !p.markedForDeletion } : p
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;

    // Validate required fields
    if (!formData.customer_phone?.trim()) {
      toast.error("Phone number is required");
      return;
    }
    if (!formData.customer_email?.trim()) {
      toast.error("Email is required");
      return;
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.customer_email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSaving(true);
    try {
      const policyUpdates = policies
        .filter((p) => !p.markedForDeletion)
        .map((p) => ({
          id: p.id,
          total_premium: parseFloat(p.total_premium) || 0,
          total_items: parseInt(p.total_items) || 0,
        }));

      const policyDeletions = policies
        .filter((p) => p.markedForDeletion)
        .map((p) => p.id);

      const { data, error } = await supabase.functions.invoke("edit_staff_sale", {
        headers: { "x-staff-session": sessionToken },
        body: {
          sale_id: sale.id,
          lead_source_id: formData.lead_source_id || null,
          customer_name: formData.customer_name || null,
          customer_email: formData.customer_email || null,
          customer_phone: formData.customer_phone || null,
          customer_zip: formData.customer_zip || null,
          sale_date: formData.sale_date,
          policy_updates: policyUpdates,
          policy_deletions: policyDeletions,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Sale updated successfully");
      queryClient.invalidateQueries({ queryKey: ["staff-sales"] });
      // Invalidate promo widgets so progress refreshes immediately
      queryClient.invalidateQueries({ queryKey: ["admin-promo-goals-widget"] });
      queryClient.invalidateQueries({ queryKey: ["promo-goals"] });
      queryClient.invalidateQueries({ queryKey: ["staff-promo-goals"] });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Failed to update sale:", err);
      toast.error(err?.message || "Failed to update sale");
    } finally {
      setIsSaving(false);
    }
  };

  if (!sale) return null;

  const activePolicies = policies.filter((p) => !p.markedForDeletion);
  const calculatedTotals = activePolicies.reduce(
    (acc, p) => ({
      premium: acc.premium + (parseFloat(p.total_premium) || 0),
      items: acc.items + (parseInt(p.total_items) || 0),
      points: acc.points + (p.total_points || 0),
    }),
    { premium: 0, items: 0, points: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Sale</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer_name">Customer Name</Label>
            <Input
              id="customer_name"
              value={formData.customer_name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, customer_name: e.target.value }))
              }
              placeholder="Customer name"
              disabled={isLoadingDetails}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, customer_email: e.target.value }))
                }
                placeholder="email@example.com"
                disabled={isLoadingDetails}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_phone">
                Phone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer_phone"
                value={formData.customer_phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, customer_phone: e.target.value }))
                }
                placeholder="(555) 555-5555"
                disabled={isLoadingDetails}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_zip">Zip Code</Label>
              <Input
                id="customer_zip"
                value={formData.customer_zip}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, customer_zip: e.target.value }))
                }
                placeholder="12345"
                disabled={isLoadingDetails}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale_date">Sale Date</Label>
              <Input
                id="sale_date"
                type="date"
                value={formData.sale_date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, sale_date: e.target.value }))
                }
                disabled={isLoadingDetails}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead_source_id">Lead Source</Label>
            <Select
              value={formData.lead_source_id}
              onValueChange={(val) => setFormData(prev => ({ ...prev, lead_source_id: val }))}
              disabled={isLoadingDetails}
            >
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
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Policies</Label>
              {isLoadingDetails && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              )}
            </div>

            <div className="mt-2 space-y-3">
              {policies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No policies on this sale.</p>
              ) : (
                policies.map((policy) => (
                  <div
                    key={policy.id}
                    className={`p-3 border rounded-md space-y-2 ${
                      policy.markedForDeletion
                        ? "bg-destructive/10 border-destructive/30"
                        : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={
                          policy.markedForDeletion
                            ? "line-through text-muted-foreground"
                            : ""
                        }
                      >
                        <span className="font-medium">
                          {policy.policy_type_name || "Unknown Policy"}
                        </span>
                        {policy.policy_number && (
                          <span className="text-sm text-muted-foreground ml-2">
                            #{policy.policy_number}
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant={policy.markedForDeletion ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => toggleDeletePolicy(policy.id)}
                        className={
                          policy.markedForDeletion
                            ? ""
                            : "text-destructive hover:text-destructive"
                        }
                        disabled={isLoadingDetails}
                      >
                        {policy.markedForDeletion ? "Undo" : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>

                    {!policy.markedForDeletion && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Premium ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={policy.total_premium}
                            onChange={(e) =>
                              handlePolicyChange(policy.id, "total_premium", e.target.value)
                            }
                            className="h-8"
                            disabled={isLoadingDetails}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Items</Label>
                          <Input
                            type="number"
                            value={policy.total_items}
                            onChange={(e) =>
                              handlePolicyChange(policy.id, "total_items", e.target.value)
                            }
                            className="h-8"
                            disabled={isLoadingDetails}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Total Premium:</span>
              <span className="font-medium">
                ${
                  calculatedTotals.premium.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                }
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Total Items:</span>
              <span className="font-medium">{calculatedTotals.items}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Total Points:</span>
              <span className="font-medium">{calculatedTotals.points}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || isLoadingDetails}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
