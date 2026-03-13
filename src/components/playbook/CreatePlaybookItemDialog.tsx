import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlaybookDomain } from "@/hooks/useFocusItems";
import type { PlaybookTag } from "@/hooks/usePlaybookTags";

interface CreatePlaybookItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: PlaybookTag[];
  onConfirm: (data: {
    title: string;
    description?: string;
    domain?: PlaybookDomain;
    sub_tag_id?: string;
  }) => void;
}

const domainOptions: { value: PlaybookDomain; label: string }[] = [
  { value: "body", label: "Body" },
  { value: "being", label: "Being" },
  { value: "balance", label: "Balance" },
  { value: "business", label: "Business" },
];

export function CreatePlaybookItemDialog({
  open,
  onOpenChange,
  tags,
  onConfirm,
}: CreatePlaybookItemDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState<PlaybookDomain | "">("");
  const [subTagId, setSubTagId] = useState<string>("");

  const availableTags = domain ? tags.filter((t) => t.domain === domain) : [];

  const handleSubmit = () => {
    if (!title.trim()) return;
    onConfirm({
      title: title.trim(),
      description: description.trim() || undefined,
      domain: domain || undefined,
      sub_tag_id: subTagId || undefined,
    });
    onOpenChange(false);
    setTitle("");
    setDescription("");
    setDomain("");
    setSubTagId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Playbook Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              placeholder="What's the action?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Optional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Domain</Label>
            <Select value={domain} onValueChange={(v) => { setDomain(v as PlaybookDomain); setSubTagId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select domain..." />
              </SelectTrigger>
              <SelectContent>
                {domainOptions.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {availableTags.length > 0 && (
            <div className="space-y-2">
              <Label>Sub-tag</Label>
              <Select value={subTagId} onValueChange={setSubTagId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sub-tag..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
