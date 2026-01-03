import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateLocal } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Pencil, Mail, Phone, MapPin, User, Calendar, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type SaleDetail = {
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
  team_member: {
    name: string;
  } | null;
  sale_policies: {
    id: string;
    policy_type_name: string;
    policy_number: string | null;
    effective_date: string;
    total_items: number | null;
    total_premium: number | null;
    total_points: number | null;
    is_vc_qualifying: boolean | null;
    sale_items: {
      id: string;
      product_type_name: string;
      item_count: number | null;
      premium: number | null;
      points: number | null;
      is_vc_qualifying: boolean | null;
    }[];
  }[];
};

interface SaleDetailModalProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (saleId: string) => void;
}

export function SaleDetailModal({ saleId, open, onOpenChange, onEdit }: SaleDetailModalProps) {
  const { data: sale, isLoading } = useQuery<SaleDetail | null>({
    queryKey: ["sale-detail", saleId],
    queryFn: async () => {
      if (!saleId) return null;

      const { data, error } = await supabase
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
          team_member:team_members!sales_team_member_id_fkey(name),
          sale_policies(
            id,
            policy_type_name,
            policy_number,
            effective_date,
            total_items,
            total_premium,
            total_points,
            is_vc_qualifying,
            sale_items(
              id,
              product_type_name,
              item_count,
              premium,
              points,
              is_vc_qualifying
            )
          )
        `
        )
        .eq("id", saleId)
        .single();

      if (error) throw error;
      return data as SaleDetail;
    },
    enabled: !!saleId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Sale Details</span>
            {sale && onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(sale.id)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Sale
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !sale ? (
          <div className="text-center py-8 text-muted-foreground">
            Sale not found.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Customer Info Header */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">{sale.customer_name}</h3>
                <div className="flex items-center gap-2">
                  {sale.is_bundle && (
                    <Badge variant="default" className="bg-blue-600">
                      {sale.bundle_type || "Bundle"}
                    </Badge>
                  )}
                  {sale.is_vc_qualifying && (
                    <Badge variant="default" className="bg-green-600">
                      VC Qualifying
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {sale.customer_email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{sale.customer_email}</span>
                  </div>
                )}
                {sale.customer_phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{sale.customer_phone}</span>
                  </div>
                )}
                {sale.customer_zip && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{sale.customer_zip}</span>
                  </div>
                )}
                {sale.team_member?.name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{sale.team_member.name}</span>
                  </div>
                )}
              </div>
              
              {sale.sale_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Sale Date: {formatDateLocal(sale.sale_date, "MMMM d, yyyy")}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Policies */}
            <div className="space-y-4">
              <h4 className="font-medium text-lg">
                Policies ({sale.sale_policies?.length || 0})
              </h4>
              
              {sale.sale_policies?.map((policy, index) => (
                <Card key={policy.id}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>{policy.policy_type_name}</span>
                        {policy.is_vc_qualifying && (
                          <Badge variant="default" className="bg-green-600 text-xs">
                            VC
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm font-normal text-muted-foreground">
                        {policy.policy_number && `#${policy.policy_number} · `}
                        Effective: {formatDateLocal(policy.effective_date)}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {/* Line Items Table */}
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                            <TableHead className="text-right">Premium</TableHead>
                            <TableHead className="text-right">Points</TableHead>
                            <TableHead className="text-center">VC</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {policy.sale_items?.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.product_type_name}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.item_count || 0}
                              </TableCell>
                              <TableCell className="text-right">
                                ${(item.premium || 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.points || 0}
                              </TableCell>
                              <TableCell className="text-center">
                                {item.is_vc_qualifying ? (
                                  <Badge variant="default" className="bg-green-600 text-xs">
                                    Yes
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">No</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Policy Subtotals */}
                    <div className="grid grid-cols-3 gap-4 mt-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-center">
                        <div className="font-semibold">{policy.total_items || 0}</div>
                        <div className="text-xs text-muted-foreground">Items</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">
                          ${(policy.total_premium || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Premium</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">{policy.total_points || 0}</div>
                        <div className="text-xs text-muted-foreground">Points</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Separator />

            {/* Sale Totals */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold">{sale.total_policies || 0}</div>
                <div className="text-sm text-muted-foreground">Policies</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{sale.total_items || 0}</div>
                <div className="text-sm text-muted-foreground">Total Items</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  ${(sale.total_premium || 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Total Premium</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{sale.total_points || 0}</div>
                <div className="text-sm text-muted-foreground">Total Points</div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
