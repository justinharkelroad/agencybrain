import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, ArrowRight, CheckCircle } from "lucide-react";
import { useCurrentKpiVersion, useUpdateFormKpiBinding } from "@/hooks/useKpiVersions";
import { useToast } from "@/hooks/use-toast";

interface FormKpiUpdateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  formName: string;
  outdatedKpi: {
    kpi_id: string;
    current_label: string;
    bound_label: string;
    bound_version_id: string;
  };
}

export function FormKpiUpdateDialog({
  isOpen,
  onOpenChange,
  formId,
  formName,
  outdatedKpi,
}: FormKpiUpdateDialogProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  
  const { data: currentVersion } = useCurrentKpiVersion(outdatedKpi.kpi_id);
  const updateBinding = useUpdateFormKpiBinding();

  const handleUpdate = async () => {
    if (!currentVersion) return;
    
    setIsUpdating(true);
    try {
      await updateBinding.mutateAsync({
        formTemplateId: formId,
        kpiVersionId: currentVersion.id,
      });
      
      toast({
        title: "Form Updated",
        description: `Form "${formName}" now uses the current KPI version.`,
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update form",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleKeepCurrent = () => {
    toast({
      title: "No Changes Made",
      description: `Form "${formName}" will continue using the previous KPI version.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            KPI Version Update Available
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              The KPI used in <strong>{formName}</strong> has been updated with a new label.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <div className="text-sm font-medium">Current Binding</div>
                <Badge variant="outline">{outdatedKpi.bound_label}</Badge>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">New Version</div>
                <Badge variant="default">{currentVersion?.label}</Badge>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <strong>Note:</strong> Updating will change future submissions to use the new label. 
              Historical data will remain unchanged.
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleUpdate} 
              disabled={isUpdating || !currentVersion}
              className="flex-1"
            >
              {isUpdating ? "Updating..." : "Update Form"}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleKeepCurrent}
              className="flex-1"
            >
              Keep Current
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}