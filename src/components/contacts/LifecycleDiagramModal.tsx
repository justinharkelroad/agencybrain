import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserPlus, FileText, CheckCircle, RefreshCw, AlertTriangle, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface LifecycleDiagramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StageInfo {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

const stages: Record<string, StageInfo> = {
  open_lead: {
    id: "open_lead",
    label: "Open Lead",
    icon: UserPlus,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/40",
    description:
      "New lead record in LQS with status 'lead'. This is the entry point for all prospects entering your sales pipeline.",
  },
  quoted: {
    id: "quoted",
    label: "Quoted",
    icon: FileText,
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/40",
    description:
      "Contact has received a quote in LQS, or was moved here from Winback for re-quoting. Ready for conversion.",
  },
  customer: {
    id: "customer",
    label: "Customer",
    icon: CheckCircle,
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/40",
    description:
      "Active customer with a sold policy, successful renewal, won-back sale, or a saved cancel audit. Your book of business.",
  },
  renewal: {
    id: "renewal",
    label: "Renewal",
    icon: RefreshCw,
    color: "text-info",
    bgColor: "bg-info/10",
    borderColor: "border-info/40",
    description:
      "Customer with an upcoming renewal that is pending or uncontacted. Requires follow-up to retain the policy.",
  },
  cancel_audit: {
    id: "cancel_audit",
    label: "Cancel Audit",
    icon: AlertTriangle,
    color: "text-caution",
    bgColor: "bg-caution/10",
    borderColor: "border-caution/40",
    description:
      "Customer at risk with an active cancel audit. If saved, returns to Customer. If lost, moves to Winback.",
  },
  winback: {
    id: "winback",
    label: "Winback",
    icon: Target,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/40",
    description:
      "Terminated policy needing win-back effort. Success loops back to Quoted for re-quoting, completing the lifecycle circle.",
  },
};

const StageBox = ({ 
  stage, 
  isSelected,
  onClick,
}: { 
  stage: StageInfo; 
  isSelected: boolean; 
  onClick: () => void;
}) => {
  const Icon = stage.icon;
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-200 cursor-pointer",
        stage.bgColor,
        stage.borderColor,
        "hover:shadow-md hover:scale-105",
        "w-[80px] h-[60px] sm:w-[100px] sm:h-[70px]",
        isSelected && "ring-2 ring-primary ring-offset-2 shadow-lg scale-105"
      )}
    >
      <Icon className={cn(stage.color, "h-5 w-5 sm:h-6 sm:w-6")} />
      <span className={cn(
        "font-semibold text-center mt-0.5 px-1 leading-tight",
        stage.color,
        "text-[10px] sm:text-xs"
      )}>
        {stage.label}
      </span>
    </button>
  );
};

export function LifecycleDiagramModal({ open, onOpenChange }: LifecycleDiagramModalProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>("customer");

  const handleStageClick = (stageId: string) => {
    setSelectedStage(stageId);
  };

  const currentStage = selectedStage ? stages[selectedStage] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Contact Lifecycle Stages</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Click any stage to see details. Contacts flow through this circular journey.
          </p>
        </DialogHeader>

        <div className="py-4">
          {/* SVG Diagram - Grid layout with straight lines */}
          <div className="relative w-full overflow-x-auto">
            <svg
              viewBox="0 0 820 320"
              className="w-full h-auto min-w-[600px]"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <marker id="arrowSuccess" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--success))" />
                </marker>
                <marker id="arrowDestructive" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--destructive))" />
                </marker>
                <marker id="arrowMuted" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--muted-foreground))" />
                </marker>
              </defs>

              {/* ===== STAGE BOXES (positioned in a grid-like arrangement) ===== */}
              
              {/* Row 1: Renewal (top right area) */}
              <foreignObject x="520" y="30" width="110" height="80">
                <div className="flex items-center justify-center h-full">
                  <StageBox
                    stage={stages.renewal}
                    isSelected={selectedStage === "renewal"}
                    onClick={() => handleStageClick("renewal")}
                  />
                </div>
              </foreignObject>

              {/* Row 2: Main horizontal flow - Open Lead → Quoted → Customer */}
              <foreignObject x="30" y="100" width="110" height="80">
                <div className="flex items-center justify-center h-full">
                  <StageBox
                    stage={stages.open_lead}
                    isSelected={selectedStage === "open_lead"}
                    onClick={() => handleStageClick("open_lead")}
                  />
                </div>
              </foreignObject>

              <foreignObject x="190" y="100" width="110" height="80">
                <div className="flex items-center justify-center h-full">
                  <StageBox
                    stage={stages.quoted}
                    isSelected={selectedStage === "quoted"}
                    onClick={() => handleStageClick("quoted")}
                  />
                </div>
              </foreignObject>

              <foreignObject x="360" y="100" width="110" height="80">
                <div className="flex items-center justify-center h-full">
                  <StageBox
                    stage={stages.customer}
                    isSelected={selectedStage === "customer"}
                    onClick={() => handleStageClick("customer")}
                  />
                </div>
              </foreignObject>

              {/* Winback (far right) */}
              <foreignObject x="690" y="100" width="110" height="80">
                <div className="flex items-center justify-center h-full">
                  <StageBox
                    stage={stages.winback}
                    isSelected={selectedStage === "winback"}
                    onClick={() => handleStageClick("winback")}
                  />
                </div>
              </foreignObject>

              {/* Row 3: Cancel Audit (below Customer) */}
              <foreignObject x="360" y="200" width="110" height="80">
                <div className="flex items-center justify-center h-full">
                  <StageBox
                    stage={stages.cancel_audit}
                    isSelected={selectedStage === "cancel_audit"}
                    onClick={() => handleStageClick("cancel_audit")}
                  />
                </div>
              </foreignObject>

              {/* ===== ARROWS (straight lines with 90° bends) ===== */}

              {/* 1. Open Lead → Quoted */}
              <line x1="135" y1="140" x2="190" y2="140" stroke="hsl(var(--success))" strokeWidth="3" markerEnd="url(#arrowSuccess)" />
              <rect x="145" y="122" width="35" height="16" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" />
              <text x="162" y="134" fill="hsl(var(--success))" fontSize="10" fontWeight="700" textAnchor="middle">YES</text>

              {/* 2. Quoted → Customer */}
              <line x1="295" y1="140" x2="360" y2="140" stroke="hsl(var(--success))" strokeWidth="3" markerEnd="url(#arrowSuccess)" />
              <rect x="310" y="122" width="35" height="16" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" />
              <text x="327" y="134" fill="hsl(var(--success))" fontSize="10" fontWeight="700" textAnchor="middle">YES</text>

              {/* 3. Customer → Renewal (up then right) */}
              <polyline
                points="465,130 490,130 490,70 520,70"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrowMuted)"
              />

              {/* 4. Renewal → Customer (RENEWED - loop back, dashed) */}
              <path
                d="M 575 35 L 575 15 L 415 15 L 415 100"
                stroke="hsl(var(--success))"
                strokeWidth="2"
                fill="none"
                strokeDasharray="6 4"
                markerEnd="url(#arrowSuccess)"
              />
              <rect x="460" y="5" width="70" height="18" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" />
              <text x="495" y="18" fill="hsl(var(--success))" fontSize="10" fontWeight="600" textAnchor="middle">RENEWED</text>

              {/* 5. Renewal → Winback (NOT RENEWED - right) */}
              <line x1="625" y1="70" x2="690" y2="70" stroke="hsl(var(--destructive))" strokeWidth="3" />
              <line x1="745" y1="70" x2="745" y2="100" stroke="hsl(var(--destructive))" strokeWidth="3" markerEnd="url(#arrowDestructive)" />
              <rect x="645" y="52" width="85" height="18" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" />
              <text x="687" y="65" fill="hsl(var(--destructive))" fontSize="10" fontWeight="600" textAnchor="middle">NOT RENEWED</text>

              {/* 6. Customer → Cancel Audit (down) */}
              <line x1="415" y1="175" x2="415" y2="200" stroke="hsl(var(--muted-foreground))" strokeWidth="2" markerEnd="url(#arrowMuted)" />

              {/* 7. Cancel Audit → Customer (PAID - right then up) */}
              <path
                d="M 465 230 L 500 230 L 500 155 L 465 155"
                stroke="hsl(var(--success))"
                strokeWidth="2"
                fill="none"
                strokeDasharray="6 4"
                markerEnd="url(#arrowSuccess)"
              />
              <rect x="482" y="180" width="35" height="16" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" />
              <text x="500" y="192" fill="hsl(var(--success))" fontSize="9" fontWeight="600" textAnchor="middle">PAID</text>

              {/* 8. Cancel Audit → Winback (NOT PAID - right then up) */}
              <polyline
                points="465,240 660,240 660,175 690,175"
                stroke="hsl(var(--destructive))"
                strokeWidth="3"
                fill="none"
              />
              <line x1="690" y1="175" x2="720" y2="175" stroke="hsl(var(--destructive))" strokeWidth="3" markerEnd="url(#arrowDestructive)" />
              <rect x="530" y="225" width="70" height="18" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" />
              <text x="565" y="238" fill="hsl(var(--destructive))" fontSize="10" fontWeight="600" textAnchor="middle">NOT PAID</text>

              {/* 9. Winback → Quoted (YES TO QUOTE - bottom loop) */}
              <path
                d="M 745 175 L 745 305 L 245 305 L 245 175"
                stroke="hsl(var(--success))"
                strokeWidth="3"
                fill="none"
                strokeDasharray="8 5"
                markerEnd="url(#arrowSuccess)"
              />
              <rect x="440" y="293" width="90" height="20" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" />
              <text x="485" y="307" fill="hsl(var(--success))" fontSize="11" fontWeight="700" textAnchor="middle">YES TO QUOTE</text>
            </svg>
          </div>

          {/* Info Panel */}
          <div className="mt-6 border rounded-lg bg-muted/30 p-4 min-h-[80px]">
            {currentStage ? (
              <div className="flex items-start gap-3">
                {(() => {
                  const CurrentIcon = currentStage.icon;
                  return (
                    <>
                      <div
                        className={cn(
                          "flex-shrink-0 rounded-lg border p-2",
                          currentStage.bgColor,
                          currentStage.borderColor
                        )}
                      >
                        <CurrentIcon className={cn(currentStage.color, "h-5 w-5")} />
                      </div>
                      <div>
                        <h4 className={cn("font-semibold", currentStage.color)}>
                          {currentStage.label}
                        </h4>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {currentStage.description}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Click a stage above to see its description.
              </p>
            )}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 bg-success rounded" />
              <span>Success path</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 bg-destructive rounded" />
              <span>Lost / At-risk path</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 border-t-2 border-dashed border-success" />
              <span>Return loop</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
