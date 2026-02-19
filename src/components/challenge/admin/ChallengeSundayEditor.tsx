import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Save } from "lucide-react";
import { useUpdateChallengeSundayModule, type ChallengeSundayModule } from "@/hooks/useChallengeAdmin";

interface ChallengeSundayEditorProps {
  module: ChallengeSundayModule;
  onClose: () => void;
}

export function ChallengeSundayEditor({ module, onClose }: ChallengeSundayEditorProps) {
  const [form, setForm] = useState({
    title: module.title,
    blurb_html: module.blurb_html || "",
    video_url: module.video_url || "",
    video_thumbnail_url: module.video_thumbnail_url || "",
    final_reflection_prompt: module.final_reflection_prompt || "",
  });

  const updateModule = useUpdateChallengeSundayModule();

  const handleSave = () => {
    updateModule.mutate(
      {
        id: module.id,
        updates: {
          title: form.title,
          blurb_html: form.blurb_html || null,
          video_url: form.video_url || null,
          video_thumbnail_url: form.video_thumbnail_url || null,
          final_reflection_prompt: form.final_reflection_prompt || null,
        },
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Sunday {module.sunday_number}
            <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
              Optional Module
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Edit content for this Sunday module
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="video_url">Video URL</Label>
            <Input
              id="video_url"
              placeholder="https://vimeo.com/... or https://youtube.com/..."
              value={form.video_url}
              onChange={(e) => setForm({ ...form, video_url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="thumbnail">Video Thumbnail URL</Label>
            <Input
              id="thumbnail"
              placeholder="https://..."
              value={form.video_thumbnail_url}
              onChange={(e) => setForm({ ...form, video_thumbnail_url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Blurb / Instructions</Label>
            <RichTextEditor
              value={form.blurb_html}
              onChange={(html) => setForm({ ...form, blurb_html: html })}
              placeholder="Instructional text shown above the form..."
            />
          </div>

          {module.has_final_reflection && (
            <div className="space-y-2">
              <Label htmlFor="reflection_prompt">Final Reflection Prompt</Label>
              <Textarea
                id="reflection_prompt"
                placeholder="Custom prompt for the final reflection..."
                value={form.final_reflection_prompt}
                onChange={(e) =>
                  setForm({ ...form, final_reflection_prompt: e.target.value })
                }
                rows={4}
              />
            </div>
          )}

          {/* Display-only structural flags */}
          <div className="flex gap-2 flex-wrap text-xs">
            {module.has_rating_section && (
              <Badge variant="secondary">Rating Section</Badge>
            )}
            {module.has_commitment_section && (
              <Badge variant="secondary">Commitment Section</Badge>
            )}
            {module.has_final_reflection && (
              <Badge variant="secondary">Final Reflection</Badge>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateModule.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateModule.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
