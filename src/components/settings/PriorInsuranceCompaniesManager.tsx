import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePriorInsuranceCompanies } from "@/hooks/usePriorInsuranceCompanies";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Building } from "lucide-react";
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

interface PriorInsuranceCompaniesManagerProps {
  agencyId?: string | null;
}

export function PriorInsuranceCompaniesManager({ agencyId: propAgencyId }: PriorInsuranceCompaniesManagerProps) {
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
  const { companies, isLoading, createCompany, updateCompany, deleteCompany } = usePriorInsuranceCompanies(agencyId);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleAddCompany = () => {
    const name = newCompanyName.trim();
    if (!name) return;
    createCompany.mutate(name, {
      onSuccess: () => setNewCompanyName(""),
    });
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    updateCompany.mutate({ id, is_active: !currentActive });
  };

  const handleDelete = (id: string) => {
    deleteCompany.mutate(id, {
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
            <Building className="h-5 w-5" />
            Prior Insurance Companies
          </CardTitle>
          <CardDescription>
            Track insurance companies customers had before switching to your agency.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new company */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter company name..."
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCompany()}
              className="flex-1"
            />
            <Button
              onClick={handleAddCompany}
              disabled={!newCompanyName.trim() || createCompany.isPending}
            >
              {createCompany.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-2">Add</span>
            </Button>
          </div>

          {/* Company list */}
          {companies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No prior insurance companies configured</p>
              <p className="text-sm">Add companies to track where customers switch from</p>
            </div>
          ) : (
            <div className="space-y-2">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{company.name}</span>
                    {!company.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={company.is_active}
                        onCheckedChange={() => handleToggleActive(company.id, company.is_active)}
                        disabled={updateCompany.isPending}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirmId(company.id)}
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
            <AlertDialogTitle>Remove Company?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the company from your list. Any existing sales marked with this company will retain their reference but won't be editable to this company.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCompany.isPending ? (
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
