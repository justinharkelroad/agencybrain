import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { PriorityLevel, CreateFocusItemData } from "@/hooks/useFocusItems";

interface CreateFocusItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: CreateFocusItemData) => void;
}

export function CreateFocusItemDialog({ open, onOpenChange, onCreate }: CreateFocusItemDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel>("mid");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority_level: priorityLevel,
    });

    // Reset form
    setTitle("");
    setDescription("");
    setPriorityLevel("mid");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Focus Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="What do you need to focus on?"
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
