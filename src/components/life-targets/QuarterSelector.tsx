import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { getAvailableQuarters, formatQuarterDisplay, getCurrentQuarter } from "@/lib/quarterUtils";

export function QuarterSelector() {
  const { currentQuarter, setCurrentQuarter } = useLifeTargetsStore();
  const availableQuarters = getAvailableQuarters();
  const currentActualQuarter = getCurrentQuarter();

  return (
    <Select value={currentQuarter} onValueChange={setCurrentQuarter}>
      <SelectTrigger className="w-[180px]">
        <Calendar className="mr-2 h-4 w-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {availableQuarters.map((quarter) => (
          <SelectItem key={quarter} value={quarter}>
            {formatQuarterDisplay(quarter)}
            {quarter === currentActualQuarter && " (Current)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
