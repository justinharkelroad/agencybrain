import { useState } from "react";
import { useCompPlans, CompPlan } from "@/hooks/useCompPlans";
import { useCompPlanMutations } from "@/hooks/useCompPlanMutations";
import { CompPlanCard } from "./CompPlanCard";
import { CreateCompPlanModal, CompPlanPrefillConfig } from "./CreateCompPlanModal";
import { CompPlanCreationChoice } from "./CompPlanCreationChoice";
import { CompPlanAssistantChat } from "./CompPlanAssistantChat";
import { StatementReportSelector } from "./StatementReportSelector";
import { PayoutPreview } from "./PayoutPreview";
import { PayoutHistoryTab } from "./PayoutHistoryTab";
import { Loader2, Plus, FileText, Calculator, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubProducerMetrics } from "@/lib/allstate-analyzer/sub-producer-analyzer";
import { ExtractedCompPlanConfig } from "@/hooks/useCompPlanAssistant";

interface CompPlansTabProps {
  agencyId: string | null;
}

export function CompPlansTab({ agencyId }: CompPlansTabProps) {
  const { data: plans, isLoading, error } = useCompPlans(agencyId);
  const { deletePlan } = useCompPlanMutations(agencyId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CompPlan | null>(null);
  const [activeTab, setActiveTab] = useState("calculate");

  // Choice modal and AI assistant state
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [prefillConfig, setPrefillConfig] = useState<CompPlanPrefillConfig | null>(null);
  const [showAIBanner, setShowAIBanner] = useState(false);

  // Payout calculator state - subProducerData is an object with producers array
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [subProducerData, setSubProducerData] = useState<{ producers: SubProducerMetrics[]; producerCount: number } | undefined>();
  const [statementMonth, setStatementMonth] = useState<number | undefined>();
  const [statementYear, setStatementYear] = useState<number | undefined>();

  const handleReportSelect = (report: { 
    id: string; 
    statement_month: number; 
    statement_year: number; 
    comparison_data: { subProducerData?: { producers: SubProducerMetrics[]; producerCount: number } } 
  } | null) => {
    if (report) {
      setSelectedReportId(report.id);
      setSubProducerData(report.comparison_data?.subProducerData);
      setStatementMonth(report.statement_month);
      setStatementYear(report.statement_year);
    } else {
      setSelectedReportId(null);
      setSubProducerData(undefined);
      setStatementMonth(undefined);
      setStatementYear(undefined);
    }
  };

  const handleCreateClick = () => {
    setEditingPlan(null);
    setPrefillConfig(null);
    setShowAIBanner(false);
    setChoiceModalOpen(true);
  };

  const handleChooseManual = () => {
    setModalOpen(true);
  };

  const handleChooseAI = () => {
    setAiChatOpen(true);
  };

  const handleAIConfigReady = (config: ExtractedCompPlanConfig) => {
    setPrefillConfig(config as CompPlanPrefillConfig);
    setShowAIBanner(true);
    setModalOpen(true);
  };

  const handleEditClick = (plan: CompPlan) => {
    setEditingPlan(plan);
    setPrefillConfig(null);
    setShowAIBanner(false);
    setModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setEditingPlan(null);
      setPrefillConfig(null);
      setShowAIBanner(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load compensation plans</p>
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <>
        <div className="text-center py-12 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-medium">No Compensation Plans</h3>
            <p className="text-muted-foreground mt-1">
              Create your first compensation plan to start tracking staff payouts.
            </p>
          </div>
          <Button className="mt-4" onClick={handleCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Button>
        </div>
        
        <CompPlanCreationChoice
          open={choiceModalOpen}
          onOpenChange={setChoiceModalOpen}
          onChooseManual={handleChooseManual}
          onChooseAI={handleChooseAI}
        />

        <CompPlanAssistantChat
          open={aiChatOpen}
          onOpenChange={setAiChatOpen}
          agencyId={agencyId}
          onConfigReady={handleAIConfigReady}
        />

        <CreateCompPlanModal
          open={modalOpen}
          onOpenChange={handleModalClose}
          agencyId={agencyId}
          editPlan={editingPlan}
          prefillConfig={prefillConfig}
          showAIBanner={showAIBanner}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Compensation Plans <span className="text-destructive">(BETA)</span></h2>
            <p className="text-sm text-muted-foreground">
              {plans.length} plan{plans.length !== 1 ? "s" : ""} configured
            </p>
          </div>
          <Button onClick={handleCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Button>
        </div>

        <div className="grid gap-4">
          {plans.map((plan) => (
            <CompPlanCard 
              key={plan.id} 
              plan={plan} 
              onEdit={() => handleEditClick(plan)}
              onDelete={() => deletePlan.mutate(plan.id)}
              isDeleting={deletePlan.isPending}
            />
          ))}
        </div>

        {/* Payout Management Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="calculate" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Calculate
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calculate" className="mt-6 space-y-6">
            <PayoutPreview
              agencyId={agencyId}
              subProducerData={subProducerData}
              statementMonth={statementMonth}
              statementYear={statementYear}
              onStatementReportSelect={handleReportSelect}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <PayoutHistoryTab agencyId={agencyId} />
          </TabsContent>
        </Tabs>
      </div>

      <CompPlanCreationChoice
        open={choiceModalOpen}
        onOpenChange={setChoiceModalOpen}
        onChooseManual={handleChooseManual}
        onChooseAI={handleChooseAI}
      />

      <CompPlanAssistantChat
        open={aiChatOpen}
        onOpenChange={setAiChatOpen}
        agencyId={agencyId}
        onConfigReady={handleAIConfigReady}
      />

      <CreateCompPlanModal
        open={modalOpen}
        onOpenChange={handleModalClose}
        agencyId={agencyId}
        editPlan={editingPlan}
        prefillConfig={prefillConfig}
        showAIBanner={showAIBanner}
      />
    </>
  );
}
