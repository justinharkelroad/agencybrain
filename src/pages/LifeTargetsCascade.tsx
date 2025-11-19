import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Save, History } from "lucide-react";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { useQuarterlyTargets, useSaveQuarterlyTargets } from "@/hooks/useQuarterlyTargets";
import { CascadeView } from "@/components/life-targets/CascadeView";
import { QuarterDisplay } from "@/components/life-targets/QuarterDisplay";
import { ChangeQuarterDialog } from "@/components/life-targets/ChangeQuarterDialog";
import { WrongMonthsAlert } from "@/components/life-targets/WrongMonthsAlert";
import { formatQuarterDisplay } from "@/lib/quarterUtils";
import { toast } from "sonner";
import { exportLifeTargetsPDF } from "@/utils/exportLifeTargetsPDF";

export default function LifeTargetsCascade() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { currentQuarter, selectedDailyActions, changeQuarter } = useLifeTargetsStore();
  
  // Use quarter from URL if present, otherwise use currentQuarter from store
  const quarter = searchParams.get('quarter') || currentQuarter;
  const { data: targets } = useQuarterlyTargets(quarter);
  const saveMutation = useSaveQuarterlyTargets();
  const isHistoricalView = !!searchParams.get('quarter');
  const [showChangeDialog, setShowChangeDialog] = useState(false);

  const handleBack = () => {
    if (isHistoricalView) {
      navigate('/life-targets/history');
    } else {
      navigate('/life-targets/daily');
    }
  };

  const handleExportPDF = () => {
    if (!targets) {
      toast.error('No targets to export');
      return;
    }
    
    try {
      exportLifeTargetsPDF(targets, selectedDailyActions, quarter);
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
      quarter: quarter,
      body_daily_actions: selectedDailyActions.body || [],
      being_daily_actions: selectedDailyActions.being || [],
      balance_daily_actions: selectedDailyActions.balance || [],
      business_daily_actions: selectedDailyActions.business || [],
    };

    saveMutation.mutate({ data: updatedTargets, showToast: true }, {
      onSuccess: () => {
        toast.success('All changes saved successfully!');
        navigate(isHistoricalView ? '/life-targets/history' : '/dashboard');
      },
      onError: (error) => {
        console.error('Failed to save changes:', error);
        toast.error('Failed to save changes');
      },
    });
  };

  const handleQuarterChange = (newQuarter: string) => {
    changeQuarter(newQuarter);
    queryClient.invalidateQueries({ queryKey: ['quarterly-targets', newQuarter] });
    navigate('/life-targets/cascade');
    toast.success(`Quarter updated to ${formatQuarterDisplay(newQuarter)}`);
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
      <div className="flex items-center justify-between gap-4">
        {/* Left: Back Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Center: Title */}
        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-4 mb-1">
            <h1 className="text-3xl font-bold">Cascading Targets View</h1>
            {!isHistoricalView && (
              <QuarterDisplay
                quarter={currentQuarter}
                onEditClick={() => setShowChangeDialog(true)}
                showEdit={!isHistoricalView}
              />
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Review and edit your complete quarterly plan
          </p>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {!isHistoricalView && (
            <Button onClick={() => navigate('/life-targets/history')} variant="outline" size="sm">
              <History className="mr-2 h-4 w-4" />
              View History
            </Button>
          )}
          <Button onClick={handleExportPDF} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button 
            onClick={handleSaveAllChanges} 
            disabled={saveMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save & Exit'}
          </Button>
        </div>
      </div>

      {/* Wrong Months Alert - shows if month labels are incorrect */}
      <WrongMonthsAlert 
        quarter={quarter} 
        missions={{
          body: targets.body_monthly_missions,
          being: targets.being_monthly_missions,
          balance: targets.balance_monthly_missions,
          business: targets.business_monthly_missions,
        }}
      />

      {/* Cascade View */}
      <CascadeView
        targets={targets}
        selectedDailyActions={selectedDailyActions}
        quarter={quarter}
      />

      <ChangeQuarterDialog
        open={showChangeDialog}
        onOpenChange={setShowChangeDialog}
        currentQuarter={currentQuarter}
        hasUnsavedChanges={false}
        onConfirm={handleQuarterChange}
      />
    </div>
  );
}
