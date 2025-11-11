import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PriorityLevel, ColumnStatus } from "@/hooks/useFocusItems";

interface AdminCreateFocusItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    title: string;
    description?: string;
    priority_level: PriorityLevel;
    column_status: ColumnStatus;
  }) => void;
  targetUserName: string;
}

const columns: { value: ColumnStatus; label: string }[] = [
  { value: "backlog", label: "Focus Items Backlog" },
  { value: "week1", label: "Within 1 Week" },
  { value: "week2", label: "Within 2 Weeks" },
  { value: "next_call", label: "Before Next Booked Call" },
  { value: "completed", label: "COMPLETED" },
];

export function AdminCreateFocusItemDialog({
  open,
  onOpenChange,
  onCreate,
  targetUserName,
}: AdminCreateFocusItemDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel>("mid");
  const [columnStatus, setColumnStatus] = useState<ColumnStatus>("backlog");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority_level: priorityLevel,
      column_status: columnStatus,
    });

    // Reset form
    setTitle("");
    setDescription("");
    setPriorityLevel("mid");
    setColumnStatus("backlog");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Focus Item for {targetUserName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="What should they focus on?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add more details (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>Priority Level *</Label>
              <RadioGroup value={priorityLevel} onValueChange={(v) => setPriorityLevel(v as PriorityLevel)}>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
                  <RadioGroupItem value="top" id="top" />
                  <Label htmlFor="top" className="flex-1 cursor-pointer text-red-300">
                    Top Level (Urgent & Important)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-orange-500/30 bg-orange-500/10">
                  <RadioGroupItem value="mid" id="mid" />
                  <Label htmlFor="mid" className="flex-1 cursor-pointer text-orange-300">
                    Mid Level (Urgent)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
                  <RadioGroupItem value="low" id="low" />
                  <Label htmlFor="low" className="flex-1 cursor-pointer text-yellow-300">
                    Low Level (Important)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="column">Place In Column *</Label>
              <Select value={columnStatus} onValueChange={(v) => setColumnStatus(v as ColumnStatus)}>
                <SelectTrigger id="column">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.value} value={col.value}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Create Focus Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
