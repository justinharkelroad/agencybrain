import { Button } from "@/components/ui/button";
import { ArrowLeft, PhoneForwarded } from "lucide-react";

interface CallEfficiencyToolProps {
  onBack: () => void;
}

export function CallEfficiencyTool({ onBack }: CallEfficiencyToolProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to tools">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-medium text-muted-foreground">Call Efficiency Tool</h3>
        </div>
      </div>
      
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <PhoneForwarded className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Call Efficiency Tool</h3>
        <p className="text-muted-foreground mt-2">
          Upload call log CSVs to analyze team performance metrics.
        </p>
        <p className="text-sm text-muted-foreground mt-4">
          Full implementation coming in Part 4.
        </p>
      </div>
    </div>
  );
}

export default CallEfficiencyTool;
