import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, Link as LinkIcon, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Attachment {
  id?: string;
  agency_id: string;
  lesson_id: string;
  name: string;
  file_url: string;
  file_size_bytes?: number;
  file_type: string;
  is_external_link: boolean;
  created_at?: string;
}

interface AttachmentUploaderProps {
  lessonId: string;
  agencyId: string;
  onAttachmentAdded?: (attachment: Attachment) => void;
  maxSizeMB?: number;
  allowedTypes?: string[];
}

export function AttachmentUploader({
  lessonId,
  agencyId,
  onAttachmentAdded,
  maxSizeMB = 25,
  allowedTypes = [".pdf", ".doc", ".docx", ".mp3", ".mp4", ".wav", ".txt"],
}: AttachmentUploaderProps) {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [externalLink, setExternalLink] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    // Validate file type
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!allowedTypes.includes(ext)) {
      toast.error("Invalid file type. Allowed: PDF, DOC, DOCX, MP3, MP4, WAV, TXT");
      return;
    }

    setIsUploading(true);

    try {
      // Upload to Supabase storage - include agencyId for proper storage policy matching
      const fileExt = file.name.split(".").pop();
      const fileName = `${agencyId}/${lessonId}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("training-files")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Save attachment record
      const { data: attachmentData, error: attachmentError } = await supabase
        .from("training_attachments")
        .insert({
          agency_id: agencyId,
          lesson_id: lessonId,
          name: file.name,
          file_url: uploadData.path,
          file_size_bytes: file.size,
          file_type: fileExt?.toLowerCase() || 'pdf',
          is_external_link: false,
        })
        .select()
        .single();

      if (attachmentError) throw attachmentError;

      toast.success("File uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["training-attachments", lessonId] });
      onAttachmentAdded?.(attachmentData);
      
      // Reset input
      event.target.value = "";
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleExternalLink = async () => {
    if (!externalLink.trim()) {
      toast.error("Please enter a valid URL");
      return;
    }

    // Basic URL validation
    try {
      new URL(externalLink);
    } catch {
      toast.error("Invalid URL format");
      return;
    }

    setIsUploading(true);

    try {
      const { data, error } = await supabase
        .from("training_attachments")
        .insert({
          agency_id: agencyId,
          lesson_id: lessonId,
          name: externalLink,
          file_url: externalLink,
          file_type: "link",
          is_external_link: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("External link added successfully");
      queryClient.invalidateQueries({ queryKey: ["training-attachments", lessonId] });
      onAttachmentAdded?.(data);
      setExternalLink("");
      setShowLinkInput(false);
    } catch (error: any) {
      console.error("Link save error:", error);
      toast.error(error.message || "Failed to save link");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Attachments</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowLinkInput(!showLinkInput)}
            disabled={isUploading}
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            Add Link
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload File
          </Button>
        </div>
      </div>

      <Input
        id="file-upload"
        type="file"
        accept={allowedTypes.join(",")}
        onChange={handleFileUpload}
        disabled={isUploading}
        className="hidden"
      />

      {showLinkInput && (
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://example.com/document.pdf"
            value={externalLink}
            onChange={(e) => setExternalLink(e.target.value)}
            disabled={isUploading}
          />
          <Button
            type="button"
            onClick={handleExternalLink}
            disabled={isUploading || !externalLink.trim()}
            size="sm"
          >
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowLinkInput(false);
              setExternalLink("");
            }}
            disabled={isUploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Upload files up to {maxSizeMB}MB (PDF, DOC, DOCX) or add external links
      </p>
    </Card>
  );
}
