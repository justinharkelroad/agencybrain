import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBrokeredCarriers } from "@/hooks/useBrokeredCarriers";
import { useBrokeredCarrierPolicyTypes } from "@/hooks/useBrokeredCarrierPolicyTypes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Building2, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const { getTypesForCarrier, createPolicyType, deletePolicyType } = useBrokeredCarrierPolicyTypes(agencyId);
  const [newCarrierName, setNewCarrierName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedCarriers, setExpandedCarriers] = useState<Set<string>>(new Set());
  const [newPolicyTypeNames, setNewPolicyTypeNames] = useState<Record<string, string>>({});

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

  const toggleExpanded = (carrierId: string) => {
    setExpandedCarriers((prev) => {
      const next = new Set(prev);
      if (next.has(carrierId)) {
        next.delete(carrierId);
      } else {
        next.add(carrierId);
      }
      return next;
    });
  };

  const handleAddPolicyType = (carrierId: string) => {
    const name = (newPolicyTypeNames[carrierId] || "").trim();
    if (!name) return;
    createPolicyType.mutate(
      { carrierId, name },
      {
        onSuccess: () =>
          setNewPolicyTypeNames((prev) => ({ ...prev, [carrierId]: "" })),
      }
    );
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
              {carriers.map((carrier) => {
                const carrierPolicyTypes = getTypesForCarrier(carrier.id);
                const isExpanded = expandedCarriers.has(carrier.id);
                return (
                  <Collapsible
                    key={carrier.id}
                    open={isExpanded}
                    onOpenChange={() => toggleExpanded(carrier.id)}
                  >
                    <div className="rounded-lg border bg-card">
                      {/* Carrier header row */}
                      <div className="flex items-center justify-between p-3 hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <span className="font-medium">{carrier.name}</span>
                          {!carrier.is_active && (
                            <Badge variant="secondary" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {carrierPolicyTypes.length} policy type{carrierPolicyTypes.length !== 1 ? "s" : ""}
                          </Badge>
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

                      {/* Expandable policy types section */}
                      <CollapsibleContent>
                        <div className="border-t px-3 pb-3 pt-2 space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Policy types appear as dropdown options when this carrier is selected on sale and quote forms.
                          </p>
                          {/* Add policy type input */}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add policy type..."
                              value={newPolicyTypeNames[carrier.id] || ""}
                              onChange={(e) =>
                                setNewPolicyTypeNames((prev) => ({
                                  ...prev,
                                  [carrier.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) =>
                                e.key === "Enter" && handleAddPolicyType(carrier.id)
                              }
                              className="flex-1 h-8 text-sm"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddPolicyType(carrier.id)}
                              disabled={
                                !(newPolicyTypeNames[carrier.id] || "").trim() ||
                                createPolicyType.isPending
                              }
                              className="h-8"
                            >
                              {createPolicyType.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                              <span className="ml-1">Add</span>
                            </Button>
                          </div>

                          {/* Policy type list */}
                          {carrierPolicyTypes.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-1">
                              No policy types configured. Users will see a free-text input instead.
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {carrierPolicyTypes.map((pt) => (
                                <div
                                  key={pt.id}
                                  className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-sm"
                                >
                                  <span>{pt.name}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    onClick={() => deletePolicyType.mutate(pt.id)}
                                    disabled={deletePolicyType.isPending}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Carrier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the carrier and all its policy types from your list. Any existing sales marked with this carrier will retain their reference but won't be editable to this carrier.
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
