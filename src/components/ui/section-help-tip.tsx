import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SectionHelpTipProps {
  title?: string;
  body: string;
}

export function SectionHelpTip({ title, body }: SectionHelpTipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            aria-label={title ? `${title} help` : "Section help"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-[320px] p-3">
          {title && <p className="text-xs font-semibold mb-1">{title}</p>}
          <p className="text-xs leading-relaxed">{body}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

