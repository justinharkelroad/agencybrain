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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Sale {
  id: string;
  sale_date: string;
  customer_name: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_zip?: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
}

interface StaffEditSaleModalProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionToken: string;
}

export function StaffEditSaleModal({
  sale,
  open,
  onOpenChange,
  sessionToken,
}: StaffEditSaleModalProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: sale?.customer_name || "",
    customer_email: sale?.customer_email || "",
    customer_phone: sale?.customer_phone || "",
    customer_zip: sale?.customer_zip || "",
    sale_date: sale?.sale_date || "",
  });

  // Update form when sale changes
  useEffect(() => {
    if (sale) {
      setFormData({
        customer_name: sale.customer_name || "",
        customer_email: sale.customer_email || "",
        customer_phone: sale.customer_phone || "",
        customer_zip: sale.customer_zip || "",
        sale_date: sale.sale_date || "",
      });
    }
  }, [sale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("edit_staff_sale", {
        headers: { "x-staff-session": sessionToken },
        body: {
          sale_id: sale.id,
          customer_name: formData.customer_name || null,
          customer_email: formData.customer_email || null,
          customer_phone: formData.customer_phone || null,
          customer_zip: formData.customer_zip || null,
          sale_date: formData.sale_date,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Sale updated successfully");
      queryClient.invalidateQueries({ queryKey: ["staff-sales"] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to update sale:", error);
      toast.error(error.message || "Failed to update sale");
    } finally {
      setIsLoading(false);
    }
  };

  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_email">Customer Email</Label>
            <Input
              id="customer_email"
              type="email"
              value={formData.customer_email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, customer_email: e.target.value }))
              }
              placeholder="customer@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_phone">Customer Phone</Label>
            <Input
              id="customer_phone"
              value={formData.customer_phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, customer_phone: e.target.value }))
              }
              placeholder="(555) 555-5555"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_zip">Customer Zip</Label>
            <Input
              id="customer_zip"
              value={formData.customer_zip}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, customer_zip: e.target.value }))
              }
              placeholder="12345"
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
            />
          </div>

          <div className="pt-2 border-t text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Premium:</span>
              <span>${(sale.total_premium || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Items:</span>
              <span>{sale.total_items || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Points:</span>
              <span>{sale.total_points || 0}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
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
