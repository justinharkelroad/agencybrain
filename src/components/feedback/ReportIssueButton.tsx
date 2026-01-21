import { useState } from "react";
import { createPortal } from "react-dom";
import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportIssueModal } from "./ReportIssueModal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ReportIssueButton() {
  const [isOpen, setIsOpen] = useState(false);

  return createPortal(
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Positioned above Stan chatbot (which is at bottom-6 right-6) */}
          <Button
            variant="outline"
            size="icon"
            className="fixed bottom-20 right-6 z-[99998] h-10 w-10 rounded-full shadow-lg bg-background hover:bg-accent border-border"
            onClick={() => setIsOpen(true)}
          >
            <Bug className="h-4 w-4" />
            <span className="sr-only">Report an issue</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Report an issue</p>
        </TooltipContent>
      </Tooltip>

      <ReportIssueModal open={isOpen} onOpenChange={setIsOpen} />
    </TooltipProvider>,
    document.body
  );
}
