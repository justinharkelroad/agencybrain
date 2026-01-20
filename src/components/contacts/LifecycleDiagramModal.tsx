import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserPlus, FileText, CheckCircle, RefreshCw, AlertTriangle, Target, ChevronRight, ArrowRight } from "lucide-react";
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

const stages: StageInfo[] = [
  {
    id: "open_lead",
    label: "Open Lead",
    icon: UserPlus,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description: "New lead record in LQS with status 'lead'. This is the entry point for prospects.",
  },
  {
    id: "quoted",
    label: "Quoted",
    icon: FileText,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    description: "Contact has an LQS quote or was moved from Winback to quoted status.",
  },
  {
    id: "customer",
    label: "Customer",
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    description: "Active customer with a sold policy, successful renewal, won-back, or saved cancel audit.",
  },
  {
    id: "renewal",
    label: "Renewal",
    icon: RefreshCw,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description: "Customer with an active renewal record that is pending or uncontacted.",
  },
  {
    id: "cancel_audit",
    label: "Cancel Audit",
    icon: AlertTriangle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    description: "Customer with an active cancel audit that has not yet been marked as Saved.",
  },
  {
    id: "winback",
    label: "Winback",
    icon: Target,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    description: "Terminated policy in active winback status. Can loop back to Quoted or Customer.",
  },
];

const StageBox = ({ 
  stage, 
  isExpanded, 
  onToggle,
  size = "normal"
}: { 
  stage: StageInfo; 
  isExpanded: boolean; 
  onToggle: () => void;
  size?: "normal" | "large";
}) => {
  const Icon = stage.icon;
  
  return (
    <div className="flex flex-col items-center">
      <button
        onClick={onToggle}
        className={cn(
          "group relative flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-200",
          stage.bgColor,
          stage.borderColor,
          "hover:shadow-lg hover:scale-105",
          size === "large" ? "w-28 h-24 sm:w-32 sm:h-28" : "w-20 h-18 sm:w-24 sm:h-20",
          isExpanded && "ring-2 ring-primary ring-offset-2"
        )}
      >
        <Icon className={cn(stage.color, size === "large" ? "h-7 w-7 sm:h-8 sm:w-8" : "h-5 w-5 sm:h-6 sm:w-6")} />
        <span className={cn(
          "font-medium text-center mt-1 px-1",
          stage.color,
          size === "large" ? "text-xs sm:text-sm" : "text-[10px] sm:text-xs"
        )}>
          {stage.label}
        </span>
        
        {/* Hover tooltip - desktop only */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 hidden [@media(hover:hover)]:block">
          <div className="bg-popover text-popover-foreground text-xs p-2 rounded-lg shadow-lg border max-w-48 text-center whitespace-normal">
            {stage.description}
          </div>
        </div>
      </button>
      
      {/* Mobile expanded description */}
      <div className={cn(
        "overflow-hidden transition-all duration-300 [@media(hover:hover)]:hidden",
        isExpanded ? "max-h-24 opacity-100 mt-2" : "max-h-0 opacity-0"
      )}>
        <div className="bg-muted/50 text-muted-foreground text-xs p-2 rounded-lg max-w-32 text-center">
          {stage.description}
        </div>
      </div>
    </div>
  );
};

const Arrow = ({ label, direction = "right", className }: { label?: string; direction?: "right" | "down" | "up"; className?: string }) => (
  <div className={cn("flex items-center justify-center", className)}>
    {direction === "right" && (
      <div className="flex flex-col items-center">
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        {label && <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>}
      </div>
    )}
    {direction === "down" && (
      <div className="flex flex-col items-center rotate-90">
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        {label && <span className="text-[10px] text-muted-foreground -rotate-90 mt-1">{label}</span>}
      </div>
    )}
    {direction === "up" && (
      <div className="flex flex-col items-center -rotate-90">
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        {label && <span className="text-[10px] text-muted-foreground rotate-90 mt-1">{label}</span>}
      </div>
    )}
  </div>
);

export function LifecycleDiagramModal({ open, onOpenChange }: LifecycleDiagramModalProps) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const toggleStage = (stageId: string) => {
    setExpandedStage(expandedStage === stageId ? null : stageId);
  };

  const getStage = (id: string) => stages.find(s => s.id === id)!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Contact Lifecycle Stages</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Contacts move through stages based on their activity. Tap or hover over a stage to learn more.
          </p>
        </DialogHeader>

        <div className="py-6">
          {/* Main Flow Diagram */}
          <div className="flex flex-col items-center gap-4">
            
            {/* Row 1: Open Lead → Quoted */}
            <div className="flex items-center gap-2 sm:gap-4">
              <StageBox 
                stage={getStage("open_lead")} 
                isExpanded={expandedStage === "open_lead"}
                onToggle={() => toggleStage("open_lead")}
              />
              <Arrow direction="right" />
              <StageBox 
                stage={getStage("quoted")} 
                isExpanded={expandedStage === "quoted"}
                onToggle={() => toggleStage("quoted")}
              />
              <Arrow direction="right" />
              <StageBox 
                stage={getStage("customer")} 
                isExpanded={expandedStage === "customer"}
                onToggle={() => toggleStage("customer")}
                size="large"
              />
            </div>

            {/* Arrows down from Customer */}
            <div className="flex items-start gap-8 sm:gap-16 ml-auto mr-8 sm:mr-12">
              <div className="flex flex-col items-center">
                <Arrow direction="down" />
                <span className="text-[10px] text-muted-foreground">Pending</span>
              </div>
              <div className="flex flex-col items-center">
                <Arrow direction="down" />
                <span className="text-[10px] text-muted-foreground">At Risk</span>
              </div>
            </div>

            {/* Row 2: Renewal and Cancel Audit */}
            <div className="flex items-center gap-4 sm:gap-8 ml-auto mr-4">
              <StageBox 
                stage={getStage("renewal")} 
                isExpanded={expandedStage === "renewal"}
                onToggle={() => toggleStage("renewal")}
              />
              <StageBox 
                stage={getStage("cancel_audit")} 
                isExpanded={expandedStage === "cancel_audit"}
                onToggle={() => toggleStage("cancel_audit")}
              />
            </div>

            {/* Arrows to outcomes */}
            <div className="flex items-center gap-4 sm:gap-12 ml-auto mr-4">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] text-green-600 font-medium">Success ↑</div>
                  <div className="text-[10px] text-red-600 font-medium">Lost ↓</div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] text-green-600 font-medium">Saved ↑</div>
                  <div className="text-[10px] text-red-600 font-medium">Lost ↓</div>
                </div>
              </div>
            </div>

            {/* Winback with loop arrow */}
            <div className="flex items-center gap-4 mt-2">
              <StageBox 
                stage={getStage("winback")} 
                isExpanded={expandedStage === "winback"}
                onToggle={() => toggleStage("winback")}
              />
              
              {/* Loop back arrow */}
              <div className="flex items-center gap-2">
                <svg width="120" height="40" className="text-muted-foreground hidden sm:block">
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
                    </marker>
                  </defs>
                  <path
                    d="M 0 20 Q 60 -20 120 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    markerEnd="url(#arrowhead)"
                  />
                </svg>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  ↩ Back to Quoted
                </span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-8 pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Stage Priority</h4>
            <p className="text-xs text-muted-foreground">
              Contacts are assigned to the <span className="font-medium">highest priority</span> stage that applies. 
              Priority order: Winback → Cancel Audit → Customer → Renewal → Quoted → Open Lead.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}