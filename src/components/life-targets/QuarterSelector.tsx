import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { getAvailableQuarters, formatQuarterDisplay, getCurrentQuarter } from "@/lib/quarterUtils";
import { useQuarterlyTargetsHistory } from "@/hooks/useQuarterlyTargetsHistory";

export function QuarterSelector() {
  const { currentQuarter, setCurrentQuarter } = useLifeTargetsStore();
  const { data: history } = useQuarterlyTargetsHistory();
  const availableQuarters = getAvailableQuarters();
  const currentActualQuarter = getCurrentQuarter();

  // Get quarters that have data
  const quartersWithData = history?.map(h => h.quarter) || [];

  return (
    <Select value={currentQuarter} onValueChange={setCurrentQuarter}>
      <SelectTrigger className="w-[200px]">
        <Calendar className="mr-2 h-4 w-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {availableQuarters.map((quarter) => {
          const hasData = quartersWithData.includes(quarter);
          const isCurrent = quarter === currentActualQuarter;
          
          return (
            <SelectItem key={quarter} value={quarter}>
              <div className="flex items-center gap-2 w-full">
                <span className="flex-1">{formatQuarterDisplay(quarter)}</span>
                {hasData && (
                  <Badge variant="secondary" className="text-xs">
                    Has Plan
                  </Badge>
                )}
                {isCurrent && !hasData && (
                  <Badge variant="outline" className="text-xs">
                    Current
                  </Badge>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
