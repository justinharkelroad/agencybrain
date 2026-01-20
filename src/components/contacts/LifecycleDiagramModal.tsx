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
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
    description: "New lead record in LQS with status 'lead'. This is the entry point for all prospects entering your sales pipeline.",
  },
  quoted: {
    id: "quoted",
    label: "Quoted",
    icon: FileText,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
    description: "Contact has received a quote in LQS, or was moved here from Winback for re-quoting. Ready for conversion.",
  },
  customer: {
    id: "customer",
    label: "Customer",
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-300",
    description: "Active customer with a sold policy, successful renewal, won-back sale, or a saved cancel audit. Your book of business.",
  },
  renewal: {
    id: "renewal",
    label: "Renewal",
    icon: RefreshCw,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
    description: "Customer with an upcoming renewal that is pending or uncontacted. Requires follow-up to retain the policy.",
  },
  cancel_audit: {
    id: "cancel_audit",
    label: "Cancel Audit",
    icon: AlertTriangle,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-300",
    description: "Customer at risk with an active cancel audit. If saved, returns to Customer. If lost, moves to Winback.",
  },
  winback: {
    id: "winback",
    label: "Winback",
    icon: Target,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
    description: "Terminated policy needing win-back effort. Success loops back to Quoted for re-quoting, completing the lifecycle circle.",
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Contact Lifecycle Stages</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Tap any stage to see details. Contacts flow through this circular journey.
          </p>
        </DialogHeader>

        <div className="py-4">
          {/* Diagram Container - Fixed aspect ratio */}
          <div className="relative w-full" style={{ paddingBottom: "75%" }}>
            <div className="absolute inset-0">
              {/* SVG Arrows Layer */}
              <svg 
                className="absolute inset-0 w-full h-full" 
                viewBox="0 0 400 300" 
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <marker id="arrowGreen" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#22c55e" />
                  </marker>
                  <marker id="arrowRed" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
                  </marker>
                  <marker id="arrowYellow" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#eab308" />
                  </marker>
                </defs>
                
                {/* Open Lead → Quoted */}
                <path 
                  d="M 75 130 L 130 130" 
                  stroke="#22c55e" 
                  strokeWidth="2.5" 
                  fill="none" 
                  markerEnd="url(#arrowGreen)" 
                />
                <text x="102" y="122" fill="#22c55e" fontSize="10" fontWeight="700" textAnchor="middle">YES!</text>
                
                {/* Quoted → Customer */}
                <path 
                  d="M 195 115 C 220 90, 260 60, 290 65" 
                  stroke="#22c55e" 
                  strokeWidth="2.5" 
                  fill="none" 
                  markerEnd="url(#arrowGreen)" 
                />
                <text x="240" y="70" fill="#22c55e" fontSize="10" fontWeight="700" textAnchor="middle">YES!</text>
                
                {/* Customer → Renewal */}
                <path 
                  d="M 350 85 C 380 100, 380 140, 355 165" 
                  stroke="#22c55e" 
                  strokeWidth="2.5" 
                  fill="none" 
                  markerEnd="url(#arrowGreen)" 
                />
                
                {/* Renewal → back to Customer (success) */}
                <path 
                  d="M 315 165 C 290 140, 290 100, 310 80" 
                  stroke="#22c55e" 
                  strokeWidth="2" 
                  fill="none" 
                  markerEnd="url(#arrowGreen)" 
                  strokeDasharray="4 2"
                />
                <text x="285" y="125" fill="#22c55e" fontSize="8" fontWeight="600" textAnchor="middle">Paid</text>
                
                {/* Customer → Cancel Audit */}
                <path 
                  d="M 290 95 C 260 130, 235 165, 220 175" 
                  stroke="#ef4444" 
                  strokeWidth="2.5" 
                  fill="none" 
                  markerEnd="url(#arrowRed)" 
                />
                <text x="270" y="145" fill="#ef4444" fontSize="9" fontWeight="600" textAnchor="middle" fontStyle="italic">At Risk</text>
                
                {/* Cancel Audit → Customer (saved) */}
                <path 
                  d="M 230 175 C 255 145, 275 115, 295 95" 
                  stroke="#eab308" 
                  strokeWidth="2" 
                  fill="none" 
                  markerEnd="url(#arrowYellow)" 
                  strokeDasharray="4 2"
                />
                <text x="275" y="160" fill="#eab308" fontSize="8" fontWeight="600" textAnchor="middle">Saved</text>
                
                {/* Renewal → Winback (lost) */}
                <path 
                  d="M 310 210 C 280 250, 180 270, 120 255" 
                  stroke="#ef4444" 
                  strokeWidth="2.5" 
                  fill="none" 
                  markerEnd="url(#arrowRed)" 
                />
                <text x="220" y="265" fill="#ef4444" fontSize="10" fontWeight="700" textAnchor="middle">NO</text>
                
                {/* Cancel Audit → Winback */}
                <path 
                  d="M 175 210 C 150 235, 120 245, 100 245" 
                  stroke="#ef4444" 
                  strokeWidth="2.5" 
                  fill="none" 
                  markerEnd="url(#arrowRed)" 
                />
                <text x="145" y="240" fill="#ef4444" fontSize="9" fontWeight="600" textAnchor="middle">Lost</text>
                
                {/* Winback → Quoted (loop back!) */}
                <path 
                  d="M 55 225 C 20 180, 20 140, 55 130" 
                  stroke="#22c55e" 
                  strokeWidth="3" 
                  fill="none" 
                  markerEnd="url(#arrowGreen)" 
                  strokeDasharray="6 3"
                />
                <text x="25" y="175" fill="#22c55e" fontSize="10" fontWeight="700" textAnchor="middle">RE-</text>
                <text x="25" y="186" fill="#22c55e" fontSize="10" fontWeight="700" textAnchor="middle">QUOTE</text>
              </svg>

              {/* Stage Boxes - Positioned with percentages */}
              
              {/* Open Lead - Far left */}
              <div className="absolute" style={{ left: "2%", top: "38%", transform: "translateY(-50%)" }}>
                <StageBox 
                  stage={stages.open_lead} 
                  isSelected={selectedStage === "open_lead"}
                  onClick={() => handleStageClick("open_lead")}
                />
              </div>
              
              {/* Quoted - Left-center */}
              <div className="absolute" style={{ left: "28%", top: "38%", transform: "translateY(-50%)" }}>
                <StageBox 
                  stage={stages.quoted} 
                  isSelected={selectedStage === "quoted"}
                  onClick={() => handleStageClick("quoted")}
                />
              </div>
              
              {/* Customer - Top center-right */}
              <div className="absolute" style={{ left: "68%", top: "18%", transform: "translateX(-50%) translateY(-50%)" }}>
                <StageBox 
                  stage={stages.customer} 
                  isSelected={selectedStage === "customer"}
                  onClick={() => handleStageClick("customer")}
                />
              </div>
              
              {/* Renewal - Right side */}
              <div className="absolute" style={{ right: "5%", top: "58%", transform: "translateY(-50%)" }}>
                <StageBox 
                  stage={stages.renewal} 
                  isSelected={selectedStage === "renewal"}
                  onClick={() => handleStageClick("renewal")}
                />
              </div>
              
              {/* Cancel Audit - Center */}
              <div className="absolute" style={{ left: "42%", top: "62%", transform: "translateX(-50%) translateY(-50%)" }}>
                <StageBox 
                  stage={stages.cancel_audit} 
                  isSelected={selectedStage === "cancel_audit"}
                  onClick={() => handleStageClick("cancel_audit")}
                />
              </div>
              
              {/* Winback - Bottom left */}
              <div className="absolute" style={{ left: "8%", top: "82%", transform: "translateY(-50%)" }}>
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
                <div className={cn(
                  "flex-shrink-0 p-2 rounded-lg",
                  currentStage.bgColor,
                  currentStage.borderColor,
                  "border"
                )}>
                  <currentStage.icon className={cn(currentStage.color, "h-5 w-5")} />
                </div>
                <div>
                  <h4 className={cn("font-semibold", currentStage.color)}>
                    {currentStage.label}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {currentStage.description}
                  </p>
                </div>
              </div>
            ) : (
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
