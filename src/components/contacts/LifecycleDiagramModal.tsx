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
    borderColor: "border-primary/35",
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
  className
}: { 
  stage: StageInfo; 
  isSelected: boolean; 
  onClick: () => void;
  className?: string;
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
        "w-[70px] h-[56px] sm:w-[90px] sm:h-[70px]",
        isSelected && "ring-2 ring-primary ring-offset-2 shadow-lg scale-105",
        className
      )}
    >
      <Icon className={cn(stage.color, "h-5 w-5 sm:h-6 sm:w-6")} />
      <span className={cn(
        "font-semibold text-center mt-0.5 px-1 leading-tight",
        stage.color,
        "text-[9px] sm:text-xs"
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
      <DialogContent className="w-[95vw] max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Contact Lifecycle Stages</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Tap any stage to see details. Contacts flow through this circular journey.
          </p>
        </DialogHeader>

        <div className="py-4">
          {/* Diagram */}
          <div className="relative w-full" style={{ paddingBottom: "46%" }}>
            <div className="absolute inset-0">
              {/* SVG Arrows Layer (fixed coords; routed to avoid crossings) */}
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 900 420"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <marker
                    id="arrowSuccess"
                    markerWidth="10"
                    markerHeight="8"
                    refX="9"
                    refY="4"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 4, 0 8" fill="hsl(var(--success))" />
                  </marker>
                  <marker
                    id="arrowDanger"
                    markerWidth="10"
                    markerHeight="8"
                    refX="9"
                    refY="4"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 4, 0 8" fill="hsl(var(--destructive))" />
                  </marker>
                  <marker
                    id="arrowWarning"
                    markerWidth="10"
                    markerHeight="8"
                    refX="9"
                    refY="4"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 4, 0 8" fill="hsl(var(--warning))" />
                  </marker>
                </defs>

                {/* Open Lead → Quoted */}
                <path
                  d="M 217 189 L 251 189"
                  stroke="hsl(var(--success))"
                  strokeWidth="4"
                  fill="none"
                  markerEnd="url(#arrowSuccess)"
                />
                <g>
                  <rect x="220" y="160" width="48" height="22" rx="8" fill="hsl(var(--background) / 0.85)" stroke="hsl(var(--border))" />
                  <text x="244" y="176" fill="hsl(var(--success))" fontSize="12" fontWeight="800" textAnchor="middle">YES!</text>
                </g>

                {/* Quoted → Customer */}
                <path
                  d="M 361 179 C 420 120 440 80 467 110"
                  stroke="hsl(var(--success))"
                  strokeWidth="4"
                  fill="none"
                  markerEnd="url(#arrowSuccess)"
                />
                <g>
                  <rect x="416" y="88" width="48" height="22" rx="8" fill="hsl(var(--background) / 0.85)" stroke="hsl(var(--border))" />
                  <text x="440" y="104" fill="hsl(var(--success))" fontSize="12" fontWeight="800" textAnchor="middle">YES!</text>
                </g>

                {/* Customer → Renewal (outer right arc) */}
                <path
                  d="M 577 102 C 680 84 800 140 701 206"
                  stroke="hsl(var(--success))"
                  strokeWidth="4"
                  fill="none"
                  markerEnd="url(#arrowSuccess)"
                />

                {/* Renewal → Customer (Paid - inner dashed arc) */}
                <path
                  d="M 701 221 C 640 168 620 140 577 117"
                  stroke="hsl(var(--success))"
                  strokeWidth="3"
                  fill="none"
                  markerEnd="url(#arrowSuccess)"
                  strokeDasharray="8 6"
                />
                <g>
                  <rect x="598" y="148" width="46" height="20" rx="8" fill="hsl(var(--background) / 0.85)" stroke="hsl(var(--border))" />
                  <text x="621" y="163" fill="hsl(var(--success))" fontSize="11" fontWeight="700" textAnchor="middle">Paid</text>
                </g>

                {/* Customer → Cancel Audit (At Risk - routed down-left) */}
                <path
                  d="M 520 132 C 470 185 455 220 445 262"
                  stroke="hsl(var(--destructive))"
                  strokeWidth="4"
                  fill="none"
                  markerEnd="url(#arrowDanger)"
                />
                <g>
                  <rect x="455" y="195" width="64" height="20" rx="8" fill="hsl(var(--background) / 0.85)" stroke="hsl(var(--border))" />
                  <text x="487" y="210" fill="hsl(var(--destructive))" fontSize="11" fontWeight="700" textAnchor="middle" fontStyle="italic">At Risk</text>
                </g>

                {/* Cancel Audit → Customer (Saved - dashed, different curvature) */}
                <path
                  d="M 468 262 C 490 220 510 165 535 120"
                  stroke="hsl(var(--warning))"
                  strokeWidth="3"
                  fill="none"
                  markerEnd="url(#arrowWarning)"
                  strokeDasharray="8 6"
                />
                <g>
                  <rect x="498" y="214" width="58" height="20" rx="8" fill="hsl(var(--background) / 0.85)" stroke="hsl(var(--border))" />
                  <text x="527" y="229" fill="hsl(var(--warning))" fontSize="11" fontWeight="700" textAnchor="middle">Saved</text>
                </g>

                {/* Cancel Audit → Winback (Lost - short bottom-left arc) */}
                <path
                  d="M 377 330 C 325 360 280 360 235 330"
                  stroke="hsl(var(--destructive))"
                  strokeWidth="4"
                  fill="none"
                  markerEnd="url(#arrowDanger)"
                />
                <g>
                  <rect x="290" y="356" width="48" height="20" rx="8" fill="hsl(var(--background) / 0.85)" stroke="hsl(var(--border))" />
                  <text x="314" y="371" fill="hsl(var(--destructive))" fontSize="11" fontWeight="700" textAnchor="middle">Lost</text>
                </g>

                {/* Renewal → Winback (NO - outer bottom arc, kept below everything) */}
                <path
                  d="M 735 286 C 610 410 365 420 235 360"
                  stroke="hsl(var(--destructive))"
                  strokeWidth="4"
                  fill="none"
                  markerEnd="url(#arrowDanger)"
                />
                <g>
                  <rect x="455" y="392" width="42" height="22" rx="8" fill="hsl(var(--background) / 0.85)" stroke="hsl(var(--border))" />
                  <text x="476" y="408" fill="hsl(var(--destructive))" fontSize="12" fontWeight="800" textAnchor="middle">NO</text>
                </g>

                {/* Winback → Quoted (Re-Quote loop - outer left arc, above Open Lead) */}
                <path
                  d="M 180 294 C 40 260 20 190 40 120 C 55 80 90 60 140 60 C 240 60 250 120 251 244"
                  stroke="hsl(var(--success))"
                  strokeWidth="4"
                  fill="none"
                  markerEnd="url(#arrowSuccess)"
                  strokeDasharray="10 8"
                />
                <g>
                  <rect x="56" y="138" width="72" height="34" rx="10" fill="hsl(var(--background) / 0.85)" stroke="hsl(var(--border))" />
                  <text x="92" y="152" fill="hsl(var(--success))" fontSize="11" fontWeight="800" textAnchor="middle">RE-</text>
                  <text x="92" y="166" fill="hsl(var(--success))" fontSize="11" fontWeight="800" textAnchor="middle">QUOTE</text>
                </g>
              </svg>

              {/* Stage Boxes */}
              <div className="absolute" style={{ left: "18%", top: "45%", transform: "translate(-50%, -50%)" }}>
                <StageBox
                  stage={stages.open_lead}
                  isSelected={selectedStage === "open_lead"}
                  onClick={() => handleStageClick("open_lead")}
                />
              </div>

              <div className="absolute" style={{ left: "34%", top: "45%", transform: "translate(-50%, -50%)" }}>
                <StageBox
                  stage={stages.quoted}
                  isSelected={selectedStage === "quoted"}
                  onClick={() => handleStageClick("quoted")}
                />
              </div>

              <div className="absolute" style={{ left: "58%", top: "22%", transform: "translate(-50%, -50%)" }}>
                <StageBox
                  stage={stages.customer}
                  isSelected={selectedStage === "customer"}
                  onClick={() => handleStageClick("customer")}
                />
              </div>

              <div className="absolute" style={{ left: "84%", top: "55%", transform: "translate(-50%, -50%)" }}>
                <StageBox
                  stage={stages.renewal}
                  isSelected={selectedStage === "renewal"}
                  onClick={() => handleStageClick("renewal")}
                />
              </div>

              <div className="absolute" style={{ left: "48%", top: "72%", transform: "translate(-50%, -50%)" }}>
                <StageBox
                  stage={stages.cancel_audit}
                  isSelected={selectedStage === "cancel_audit"}
                  onClick={() => handleStageClick("cancel_audit")}
                />
              </div>

              <div className="absolute" style={{ left: "20%", top: "83%", transform: "translate(-50%, -50%)" }}>
                <StageBox
                  stage={stages.winback}
                  isSelected={selectedStage === "winback"}
                  onClick={() => handleStageClick("winback")}
                />
              </div>
            </div>
          </div>

          {/* Info Panel - Always visible below diagram */}
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
                Tap a stage above to see its description.
              </p>
            )}
              <p className="text-sm text-muted-foreground text-center">
                Tap a stage above to see its description.
              </p>
            )}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Stage Priority</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Contacts are assigned to the <span className="font-semibold">highest priority</span> stage. 
              Priority order: Winback → Cancel Audit → Customer → Renewal → Quoted → Open Lead.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
