import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit2, Plus, AlertCircle, Check, X } from "lucide-react";
import { useKpis, useAgencyKpis } from "@/hooks/useKpis";
import { useOutdatedFormKpis } from "@/hooks/useKpiVersions";
import { FormKpiUpdateDialog } from "./FormKpiUpdateDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KPIManagementDialogProps {
  children: React.ReactNode;
  memberId: string;
  role: "Sales" | "Service";
  onKPIUpdated?: () => void;
}

export default function KPIManagementDialog({ 
  children, 
  memberId, 
  role,
  onKPIUpdated 
}: KPIManagementDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [deleteKpiId, setDeleteKpiId] = useState<string | null>(null);
  const [deleteKpiSlug, setDeleteKpiSlug] = useState<string | null>(null);
  const [affectedForms, setAffectedForms] = useState<string[]>([]);
  const [checkingImpact, setCheckingImpact] = useState(false);
  const [formUpdateDialog, setFormUpdateDialog] = useState<{
    formId: string;
    formName: string;
    kpi: any;
  } | null>(null);
  
  const { data: kpiData, refetch } = useAgencyKpis(""); // All KPIs for management - no role filter needed
  const { data: outdatedForms } = useOutdatedFormKpis(""); // TODO: Get agency ID properly

  // LAYER 3: Check affected forms before showing delete dialog
  const handleDeleteClick = async (kpiId: string, kpiSlug: string) => {
    setCheckingImpact(true);
    try {
      // Query for forms that use this KPI
      const { data: forms } = await supabase
        .from('form_templates')
        .select('name')
        .eq('is_active', true)
        .ilike('schema_json::text', `%"${kpiSlug}"%`);
      
      setAffectedForms(forms?.map(f => f.name) || []);
      setDeleteKpiId(kpiId);
      setDeleteKpiSlug(kpiSlug);
    } catch (error) {
      console.error('Error checking form impact:', error);
      toast.error('Failed to check KPI usage');
    } finally {
      setCheckingImpact(false);
    }
  };

  const handleRename = async (kpiId: string, newLabel: string) => {
    // TODO: Implement KPI renaming functionality
    toast.error("KPI renaming is temporarily disabled");
    setEditingKpi(null);
  };

  const handleDelete = async (kpiId: string) => {
    try {
      const { error } = await supabase.functions.invoke('delete_kpi', {
        body: { kpi_id: kpiId }
      });
      
      if (error) throw error;
      
      toast.success("KPI deleted successfully");
      setDeleteKpiId(null);
      refetch();
      onKPIUpdated?.();
    } catch (error: any) {
      toast.error(`Failed to delete KPI: ${error.message}`);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage {role} KPIs</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {outdatedForms && outdatedForms.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {outdatedForms.length} form(s) are using outdated KPI versions and may need updating.
                </AlertDescription>
              </Alert>
            )}
            
            {kpiData?.map((kpi) => (
              <div key={kpi.kpi_id} className="flex items-center justify-between p-4 border rounded-lg">
                {editingKpi === kpi.kpi_id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRename(kpi.kpi_id, editingLabel);
                        } else if (e.key === 'Escape') {
                          setEditingKpi(null);
                        }
                      }}
                      autoFocus
                    />
                    <Button 
                      size="sm" 
                      onClick={() => handleRename(kpi.kpi_id, editingLabel)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setEditingKpi(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Label className="font-medium">{kpi.label}</Label>
                      <Badge variant="outline" className="text-xs">
                        {kpi.slug}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingKpi(kpi.kpi_id);
                          setEditingLabel(kpi.label);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteClick(kpi.kpi_id, kpi.slug)}
                        disabled={checkingImpact}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteKpiId} onOpenChange={() => { setDeleteKpiId(null); setAffectedForms([]); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete KPI
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {affectedForms.length > 0 ? (
                  <>
                    <div className="bg-destructive/10 border border-destructive rounded-md p-3">
                      <p className="font-semibold text-destructive">
                        STOP - This KPI is actively being used
                      </p>
                    </div>
                    <p>This KPI is currently used in these forms:</p>
                    <ul className="list-disc ml-6 font-medium">
                      {affectedForms.map(name => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                    <p className="text-destructive font-medium">
                      If you delete this KPI, team members will NOT be able to submit these forms until you fix them.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      To safely delete: First edit the forms above to remove or replace this KPI, then come back and delete it.
                    </p>
                  </>
                ) : (
                  <p>
                    This will archive the KPI. Historical data will be preserved. No active forms use this KPI.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteKpiId && handleDelete(deleteKpiId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={affectedForms.length > 0}
            >
              {affectedForms.length > 0 ? "Cannot Delete - Forms Using This KPI" : "Delete KPI"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {formUpdateDialog && (
        <FormKpiUpdateDialog
          isOpen={true}
          onOpenChange={(open) => !open && setFormUpdateDialog(null)}
          formId={formUpdateDialog.formId}
          formName={formUpdateDialog.formName}
          outdatedKpi={formUpdateDialog.kpi}
        />
      )}
    </>
  );
}