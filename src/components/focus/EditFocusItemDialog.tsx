import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { FocusItem, PriorityLevel, UpdateFocusItemData } from "@/hooks/useFocusItems";

interface EditFocusItemDialogProps {
  item: FocusItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, data: UpdateFocusItemData) => void;
}

export function EditFocusItemDialog({ item, open, onOpenChange, onUpdate }: EditFocusItemDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel>("mid");

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || "");
      setPriorityLevel(item.priority_level);
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !title.trim()) return;

    onUpdate(item.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      priority_level: priorityLevel,
    });

    onOpenChange(false);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Focus Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                placeholder="What do you need to focus on?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
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
                  <RadioGroupItem value="top" id="edit-top" />
                  <Label htmlFor="edit-top" className="flex-1 cursor-pointer text-red-300">
                    Top Level (Urgent & Important)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-orange-500/30 bg-orange-500/10">
                  <RadioGroupItem value="mid" id="edit-mid" />
                  <Label htmlFor="edit-mid" className="flex-1 cursor-pointer text-orange-300">
                    Mid Level (Urgent)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
                  <RadioGroupItem value="low" id="edit-low" />
                  <Label htmlFor="edit-low" className="flex-1 cursor-pointer text-yellow-300">
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
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
