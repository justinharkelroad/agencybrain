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
  const [formUpdateDialog, setFormUpdateDialog] = useState<{
    formId: string;
    formName: string;
    kpi: any;
  } | null>(null);
  
  const { data: kpiData, refetch } = useAgencyKpis(""); // Will need agency ID from context
  const { data: outdatedForms } = useOutdatedFormKpis(""); // TODO: Get agency ID properly

  const handleRename = async (kpiId: string, newLabel: string) => {
    try {
      const { error } = await supabase.functions.invoke('rename_kpi', {
        body: { kpi_id: kpiId, new_label: newLabel }
      });
      
      if (error) throw error;
      
      toast.success("KPI renamed successfully. Check forms that may need updating.");
      setEditingKpi(null);
      refetch();
      onKPIUpdated?.();
      
      // Check for forms that need updating after KPI rename
      setTimeout(() => {
        if (outdatedForms && outdatedForms.length > 0) {
          toast.info(`${outdatedForms.length} forms are using outdated KPI versions.`);
        }
      }, 1000);
    } catch (error: any) {
      toast.error(`Failed to rename KPI: ${error.message}`);
    }
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
                        onClick={() => setDeleteKpiId(kpi.kpi_id)}
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

      <AlertDialog open={!!deleteKpiId} onOpenChange={() => setDeleteKpiId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KPI</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this KPI? This will remove it from future forms but preserve historical data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteKpiId && handleDelete(deleteKpiId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete KPI
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