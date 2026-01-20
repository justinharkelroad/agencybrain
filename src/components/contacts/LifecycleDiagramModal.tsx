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
    borderColor: "border-blue-200",
    description: "New lead record in LQS with status 'lead'. Entry point for prospects.",
  },
  quoted: {
    id: "quoted",
    label: "Quoted",
    icon: FileText,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    description: "Has an LQS quote or was moved from Winback to quoted status.",
  },
  customer: {
    id: "customer",
    label: "Customer",
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    description: "Active customer with a sold policy, successful renewal, won-back, or saved cancel audit.",
  },
  renewal: {
    id: "renewal",
    label: "Renewal",
    icon: RefreshCw,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description: "Customer with an active renewal record that is pending or uncontacted.",
  },
  cancel_audit: {
    id: "cancel_audit",
    label: "Cancel Audit",
    icon: AlertTriangle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    description: "Customer with an active cancel audit that has not yet been marked as Saved.",
  },
  winback: {
    id: "winback",
    label: "Winback",
    icon: Target,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    description: "Terminated policy in active winback status. Can loop back to Quoted.",
  },
};

const StageBox = ({ 
  stage, 
  isHovered, 
  onHover,
  onLeave,
  onTap,
  size = "normal",
  className
}: { 
  stage: StageInfo; 
  isHovered: boolean; 
  onHover: () => void;
  onLeave: () => void;
  onTap: () => void;
  size?: "normal" | "large";
  className?: string;
}) => {
  const Icon = stage.icon;
  
  return (
    <div 
      className={cn("relative", className)}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onTap}
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-200 cursor-pointer",
          stage.bgColor,
          stage.borderColor,
          "hover:shadow-lg hover:scale-105",
          size === "large" ? "w-24 h-20 sm:w-28 sm:h-24" : "w-20 h-16 sm:w-24 sm:h-20",
          isHovered && "ring-2 ring-primary ring-offset-2 shadow-lg scale-105"
        )}
      >
        <Icon className={cn(stage.color, size === "large" ? "h-6 w-6 sm:h-8 sm:w-8" : "h-5 w-5 sm:h-6 sm:w-6")} />
        <span className={cn(
          "font-medium text-center mt-1 px-1",
          stage.color,
          size === "large" ? "text-xs sm:text-sm" : "text-[10px] sm:text-xs"
        )}>
          {stage.label}
        </span>
      </div>
      
      {/* Info box - always visible when hovered/tapped */}
      <div className={cn(
        "absolute z-20 transition-all duration-200 pointer-events-none",
        "bg-card text-card-foreground text-xs p-3 rounded-lg shadow-xl border-2 w-44",
        isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        // Position based on stage
        stage.id === "customer" ? "top-full left-1/2 -translate-x-1/2 mt-2" :
        stage.id === "renewal" ? "top-full left-0 mt-2" :
        stage.id === "cancel_audit" ? "top-full right-0 mt-2" :
        stage.id === "winback" ? "-top-2 left-full ml-2 -translate-y-full" :
        "top-full left-1/2 -translate-x-1/2 mt-2"
      )}>
        <div className="font-medium mb-1">{stage.label}</div>
        <div className="text-muted-foreground leading-relaxed">{stage.description}</div>
      </div>
    </div>
  );
};

export function LifecycleDiagramModal({ open, onOpenChange }: LifecycleDiagramModalProps) {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Contact Lifecycle Stages</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Contacts move through stages based on their activity. Tap or hover over a stage to learn more.
          </p>
        </DialogHeader>

        <div className="py-6 px-4">
          {/* Circular Flow Diagram */}
          <div className="relative min-h-[420px] sm:min-h-[480px]">
            
            {/* SVG Arrows - The circular flow */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 700 420" preserveAspectRatio="xMidYMid meet">
              <defs>
                <marker id="arrowGreen" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#22c55e" />
                </marker>
                <marker id="arrowRed" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
                </marker>
                <marker id="arrowGray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
                </marker>
              </defs>
              
              {/* Open Lead → Quoted */}
              <path d="M 95 200 L 175 200" stroke="#22c55e" strokeWidth="2" fill="none" markerEnd="url(#arrowGreen)" />
              <text x="135" y="185" fill="#22c55e" fontSize="12" fontWeight="600" textAnchor="middle">YES!</text>
              
              {/* Quoted → Customer (curved up) */}
              <path d="M 280 180 Q 350 80 420 130" stroke="#22c55e" strokeWidth="2" fill="none" markerEnd="url(#arrowGreen)" />
              <text x="350" y="85" fill="#22c55e" fontSize="12" fontWeight="600" textAnchor="middle">YES!</text>
              
              {/* Customer → Renewal (curved right) */}
              <path d="M 530 145 Q 600 145 600 220" stroke="#22c55e" strokeWidth="2" fill="none" markerEnd="url(#arrowGreen)" />
              <text x="580" y="175" fill="#22c55e" fontSize="12" fontWeight="600" textAnchor="middle">YES!</text>
              
              {/* Renewal → Customer (success - curved back up) */}
              <path d="M 580 270 Q 560 200 530 165" stroke="#22c55e" strokeWidth="2" fill="none" markerEnd="url(#arrowGreen)" />
              
              {/* Customer → Cancel Audit (down) */}
              <path d="M 450 175 Q 430 230 400 260" stroke="#ef4444" strokeWidth="2" fill="none" markerEnd="url(#arrowRed)" />
              <text x="400" y="225" fill="#ef4444" fontSize="11" fontStyle="italic" textAnchor="middle">At Risk</text>
              
              {/* Cancel Audit → Customer (saved) */}
              <path d="M 380 280 Q 420 220 450 170" stroke="#eab308" strokeWidth="2" fill="none" markerEnd="url(#arrowGreen)" />
              
              {/* Renewal → Winback (lost) */}
              <path d="M 560 320 Q 500 380 320 380" stroke="#ef4444" strokeWidth="2" fill="none" markerEnd="url(#arrowRed)" />
              <text x="450" y="370" fill="#ef4444" fontSize="11" fontWeight="600" textAnchor="middle">NO</text>
              
              {/* Cancel Audit → Winback (lost) */}
              <path d="M 350 320 Q 300 360 280 370" stroke="#ef4444" strokeWidth="2" fill="none" markerEnd="url(#arrowRed)" />
              <text x="290" y="345" fill="#ef4444" fontSize="11" fontWeight="600" textAnchor="middle">NOT PAID</text>
              
              {/* Winback → Quoted (loop back - big curved arrow) */}
              <path d="M 180 360 Q 60 300 100 220" stroke="#22c55e" strokeWidth="2.5" strokeDasharray="6 3" fill="none" markerEnd="url(#arrowGreen)" />
              <text x="70" y="290" fill="#22c55e" fontSize="12" fontWeight="600" textAnchor="middle">YES!</text>
            </svg>
            
            {/* Stage Boxes - Positioned absolutely for circular layout */}
            
            {/* Open Lead - Left */}
            <div className="absolute left-[2%] sm:left-[5%] top-[42%] -translate-y-1/2">
              <StageBox 
                stage={stages.open_lead} 
                isHovered={hoveredStage === "open_lead"}
                onHover={() => setHoveredStage("open_lead")}
                onLeave={() => setHoveredStage(null)}
                onTap={() => setHoveredStage(hoveredStage === "open_lead" ? null : "open_lead")}
              />
            </div>
            
            {/* Quoted - Center-left, slightly higher */}
            <div className="absolute left-[22%] sm:left-[25%] top-[38%] -translate-y-1/2">
              <StageBox 
                stage={stages.quoted} 
                isHovered={hoveredStage === "quoted"}
                onHover={() => setHoveredStage("quoted")}
                onLeave={() => setHoveredStage(null)}
                onTap={() => setHoveredStage(hoveredStage === "quoted" ? null : "quoted")}
              />
            </div>
            
            {/* Customer - Top center, larger */}
            <div className="absolute left-[52%] sm:left-[55%] top-[18%] -translate-x-1/2 -translate-y-1/2">
              <StageBox 
                stage={stages.customer} 
                isHovered={hoveredStage === "customer"}
                onHover={() => setHoveredStage("customer")}
                onLeave={() => setHoveredStage(null)}
                onTap={() => setHoveredStage(hoveredStage === "customer" ? null : "customer")}
                size="large"
              />
            </div>
            
            {/* Renewal - Right side */}
            <div className="absolute right-[8%] sm:right-[12%] top-[55%] -translate-y-1/2">
              <StageBox 
                stage={stages.renewal} 
                isHovered={hoveredStage === "renewal"}
                onHover={() => setHoveredStage("renewal")}
                onLeave={() => setHoveredStage(null)}
                onTap={() => setHoveredStage(hoveredStage === "renewal" ? null : "renewal")}
              />
            </div>
            
            {/* Cancel Audit - Center, below Customer */}
            <div className="absolute left-[45%] sm:left-[48%] top-[62%] -translate-x-1/2 -translate-y-1/2">
              <StageBox 
                stage={stages.cancel_audit} 
                isHovered={hoveredStage === "cancel_audit"}
                onHover={() => setHoveredStage("cancel_audit")}
                onLeave={() => setHoveredStage(null)}
                onTap={() => setHoveredStage(hoveredStage === "cancel_audit" ? null : "cancel_audit")}
              />
            </div>
            
            {/* Winback - Bottom center-left */}
            <div className="absolute left-[25%] sm:left-[28%] top-[85%] -translate-y-1/2">
              <StageBox 
                stage={stages.winback} 
                isHovered={hoveredStage === "winback"}
                onHover={() => setHoveredStage("winback")}
                onLeave={() => setHoveredStage(null)}
                onTap={() => setHoveredStage(hoveredStage === "winback" ? null : "winback")}
              />
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Stage Priority</h4>
            <p className="text-xs text-muted-foreground">
              Contacts are assigned to the <span className="font-medium">highest priority</span> stage that applies. 
              Priority: Winback → Cancel Audit → Customer → Renewal → Quoted → Open Lead.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
