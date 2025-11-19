import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Info, Calendar } from "lucide-react";
import { formatQuarterDisplay } from "@/lib/quarterUtils";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";

interface QuarterStatusAlertProps {
  currentQuarter: string;
  availableQuarters: string[];
}

export function QuarterStatusAlert({ currentQuarter, availableQuarters }: QuarterStatusAlertProps) {
  const { setCurrentQuarter } = useLifeTargetsStore();

  if (availableQuarters.length === 0) return null;

  return (
    <Alert className="mb-6 border-primary/20 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium text-foreground mb-1">
            No plan for {formatQuarterDisplay(currentQuarter)} yet
          </p>
          <p className="text-sm text-muted-foreground">
            You have plans for: {availableQuarters.map(formatQuarterDisplay).join(", ")}
          </p>
        </div>
        <div className="flex gap-2">
          {availableQuarters.slice(0, 2).map((quarter) => (
            <Button
              key={quarter}
              variant="outline"
              size="sm"
              onClick={() => setCurrentQuarter(quarter)}
              className="whitespace-nowrap"
            >
              <Calendar className="h-3 w-3 mr-1" />
              View {formatQuarterDisplay(quarter)}
            </Button>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
