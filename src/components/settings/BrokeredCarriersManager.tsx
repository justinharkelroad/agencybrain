import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBrokeredCarriers } from "@/hooks/useBrokeredCarriers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Building2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BrokeredCarriersManagerProps {
  agencyId?: string | null;
}

export function BrokeredCarriersManager({ agencyId: propAgencyId }: BrokeredCarriersManagerProps) {
  const { user } = useAuth();

  // Fetch agencyId if not provided as prop
  const { data: profile } = useQuery({
    queryKey: ["profile-agency", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !propAgencyId,
  });

  const agencyId = propAgencyId || profile?.agency_id || null;
  const { carriers, isLoading, createCarrier, updateCarrier, deleteCarrier } = useBrokeredCarriers(agencyId);
  const [newCarrierName, setNewCarrierName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleAddCarrier = () => {
    const name = newCarrierName.trim();
    if (!name) return;
    createCarrier.mutate(name, {
      onSuccess: () => setNewCarrierName(""),
    });
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    updateCarrier.mutate({ id, is_active: !currentActive });
  };

  const handleDelete = (id: string) => {
    deleteCarrier.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Brokered Carriers
          </CardTitle>
          <CardDescription>
            Manage external carriers for brokered business. Sales marked as brokered can be tracked separately in compensation calculations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new carrier */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter carrier name..."
              value={newCarrierName}
              onChange={(e) => setNewCarrierName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCarrier()}
              className="flex-1"
            />
            <Button
              onClick={handleAddCarrier}
              disabled={!newCarrierName.trim() || createCarrier.isPending}
            >
              {createCarrier.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-2">Add</span>
            </Button>
          </div>

          {/* Carrier list */}
          {carriers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No brokered carriers configured</p>
              <p className="text-sm">Add carriers to track brokered business separately</p>
            </div>
          ) : (
            <div className="space-y-2">
              {carriers.map((carrier) => (
                <div
                  key={carrier.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{carrier.name}</span>
                    {!carrier.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={carrier.is_active}
                        onCheckedChange={() => handleToggleActive(carrier.id, carrier.is_active)}
                        disabled={updateCarrier.isPending}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirmId(carrier.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Carrier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the carrier from your list. Any existing sales marked with this carrier will retain their reference but won't be editable to this carrier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCarrier.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
