import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Save } from "lucide-react";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { useQuarterlyTargets, useSaveQuarterlyTargets } from "@/hooks/useQuarterlyTargets";
import { CascadeView } from "@/components/life-targets/CascadeView";
import { toast } from "sonner";
import { exportLifeTargetsPDF } from "@/utils/exportLifeTargetsPDF";

export default function LifeTargetsCascade() {
  const navigate = useNavigate();
  const { currentQuarter, selectedDailyActions } = useLifeTargetsStore();
  const { data: targets } = useQuarterlyTargets(currentQuarter);
  const saveMutation = useSaveQuarterlyTargets();

  const handleBack = () => {
    navigate('/life-targets/daily');
  };

  const handleExportPDF = () => {
    if (!targets) {
      toast.error('No targets to export');
      return;
    }
    
    try {
      exportLifeTargetsPDF(targets, selectedDailyActions, currentQuarter);
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  };

  const handleSaveAllChanges = async () => {
    if (!targets) return;

    const updatedTargets = {
      ...targets,
      quarter: currentQuarter,
      body_daily_actions: selectedDailyActions.body || [],
      being_daily_actions: selectedDailyActions.being || [],
      balance_daily_actions: selectedDailyActions.balance || [],
      business_daily_actions: selectedDailyActions.business || [],
    };

    saveMutation.mutate({ data: updatedTargets, showToast: true }, {
      onSuccess: () => {
        toast.success('All changes saved successfully!');
        navigate('/dashboard');
      },
      onError: (error) => {
        console.error('Failed to save changes:', error);
        toast.error('Failed to save changes');
      },
    });
  };

  if (!targets) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">No targets found. Please set your quarterly targets first.</p>
          <Button onClick={() => navigate('/life-targets/quarterly')}>
            Set Targets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Cascading Targets View</h1>
            <p className="text-muted-foreground mt-1">
              Review and edit your complete quarterly plan
            </p>
          </div>
        </div>

        <Button onClick={handleExportPDF} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {/* Cascade View */}
      <CascadeView
        targets={targets}
        selectedDailyActions={selectedDailyActions}
        quarter={currentQuarter}
      />
    </div>
  );
}
