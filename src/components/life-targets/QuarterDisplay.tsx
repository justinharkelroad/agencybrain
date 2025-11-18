import { Calendar, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatQuarterDisplay, getCurrentQuarter } from "@/lib/quarterUtils";

interface QuarterDisplayProps {
  quarter: string;
  onEditClick: () => void;
  showEdit?: boolean;
}

export function QuarterDisplay({ quarter, onEditClick, showEdit = true }: QuarterDisplayProps) {
  const currentQuarter = getCurrentQuarter();
  const isCurrent = quarter === currentQuarter;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span className="text-sm font-medium">
          {formatQuarterDisplay(quarter)}
          {isCurrent && <span className="ml-1 text-xs text-primary">(Current)</span>}
        </span>
      </div>
      {showEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEditClick}
          className="h-7 px-2"
        >
          <Edit2 className="h-3 w-3 mr-1" />
          Edit
        </Button>
      )}
    </div>
  );
}
