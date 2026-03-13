import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, addDays, startOfWeek, isBefore, startOfDay } from "date-fns";
import type { PlaybookDomain } from "@/hooks/useFocusItems";
import type { PlaybookTag } from "@/hooks/usePlaybookTags";

interface ScheduleItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTitle: string;
  weekStart: Date;
  tags: PlaybookTag[];
  dayItemCounts: Record<string, number>;
  onConfirm: (date: string, domain?: PlaybookDomain, subTagId?: string) => void;
  defaultDate?: string;
}

const domainOptions: { value: PlaybookDomain; label: string }[] = [
  { value: "body", label: "Body" },
  { value: "being", label: "Being" },
  { value: "balance", label: "Balance" },
  { value: "business", label: "Business" },
];

export function ScheduleItemDialog({
  open,
  onOpenChange,
  itemTitle,
  weekStart,
  tags,
  dayItemCounts,
  onConfirm,
  defaultDate,
}: ScheduleItemDialogProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [domain, setDomain] = useState<PlaybookDomain | "">("");
  const [subTagId, setSubTagId] = useState<string>("");

  // Pre-select date when opened from drag-and-drop
  useEffect(() => {
    if (open && defaultDate) {
      setSelectedDate(defaultDate);
    }
  }, [open, defaultDate]);

  // Reset state when dialog opens/closes
  const resetState = () => {
    setSelectedDate("");
    setDomain("");
    setSubTagId("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  };

  const today = startOfDay(new Date());

  // Generate Mon-Fri for the current week
  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const count = dayItemCounts[dateStr] || 0;
    const past = isBefore(date, today);
    return { date, dateStr, label: format(date, "EEE, MMM d"), count, past };
  });

  const availableTags = domain ? tags.filter((t) => t.domain === domain) : [];

  const handleConfirm = () => {
    if (!selectedDate) return;
    onConfirm(selectedDate, domain || undefined, subTagId || undefined);
    handleOpenChange(false);
  };

  const selectedDayCount = dayItemCounts[selectedDate] || 0;
  const isFull = selectedDayCount >= 4;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Power Play</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              &ldquo;{itemTitle}&rdquo;
            </p>
          </div>

          {/* Day picker */}
          <div className="space-y-2">
            <Label>Day</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {weekDays.map((wd) => (
                <button
                  key={wd.dateStr}
                  disabled={wd.past || wd.count >= 4}
                  onClick={() => setSelectedDate(wd.dateStr)}
                  className={`
                    flex flex-col items-center rounded-lg border p-2 text-xs transition-all
                    ${selectedDate === wd.dateStr ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}
                    ${wd.past ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                    ${wd.count >= 4 && !wd.past ? "border-destructive/30 bg-destructive/5" : ""}
                  `}
                >
                  <span className="font-medium">{format(wd.date, "EEE")}</span>
                  <span className="text-muted-foreground">{format(wd.date, "d")}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {wd.count}/4
                  </span>
                </button>
              ))}
            </div>
            {isFull && selectedDate && (
              <p className="text-xs text-destructive">This day already has 4 Power Plays.</p>
            )}
          </div>

          {/* Domain */}
          <div className="space-y-2">
            <Label>Domain (optional)</Label>
            <Select value={domain} onValueChange={(v) => { setDomain(v as PlaybookDomain); setSubTagId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select domain..." />
              </SelectTrigger>
              <SelectContent>
                {domainOptions.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub-tag */}
          {availableTags.length > 0 && (
            <div className="space-y-2">
              <Label>Sub-tag (optional)</Label>
              <Select value={subTagId} onValueChange={setSubTagId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sub-tag..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedDate || isFull}>
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
