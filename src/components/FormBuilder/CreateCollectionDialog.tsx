import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Info } from "lucide-react";

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpiFields: Array<{ key: string; label: string }>;
  onSubmit: (data: { name: string; description?: string; controllingKpiKey: string }) => void;
}

export default function CreateCollectionDialog({
  open,
  onOpenChange,
  kpiFields,
  onSubmit,
}: CreateCollectionDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [controllingKpiKey, setControllingKpiKey] = useState("");

  const handleSubmit = () => {
    if (!name.trim() || !controllingKpiKey) return;

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      controllingKpiKey,
    });

    // Reset form
    setName("");
    setDescription("");
    setControllingKpiKey("");
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setControllingKpiKey("");
    onOpenChange(false);
  };

  const isValid = name.trim().length > 0 && controllingKpiKey.length > 0;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Custom Detail Collection</DialogTitle>
          <DialogDescription>
            Create a new repeater section with custom fields
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="collection-name">
              Collection Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="collection-name"
              placeholder="e.g., Referrals Received"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="collection-description">Description (optional)</Label>
            <Textarea
              id="collection-description"
              placeholder="e.g., Track referral details from each interaction"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="controlling-kpi">
              Controlled by KPI Field <span className="text-destructive">*</span>
            </Label>
            <Select value={controllingKpiKey} onValueChange={setControllingKpiKey}>
              <SelectTrigger>
                <SelectValue placeholder="Select KPI..." />
              </SelectTrigger>
              <SelectContent>
                {kpiFields.map((kpi) => (
                  <SelectItem key={kpi.key} value={kpi.key}>
                    {kpi.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              The number entered for this KPI determines how many detail entries the user must complete.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Create Collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
