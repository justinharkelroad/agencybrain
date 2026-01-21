import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Loader2, File as FileIcon, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useStaffAuth } from "@/hooks/useStaffAuth";

interface ReportIssueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PendingFile {
  file: File;
  id: string;
}

export function ReportIssueModal({ open, onOpenChange }: ReportIssueModalProps) {
  const [description, setDescription] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const { toast } = useToast();

  // Get auth from both contexts
  const { user: brainUser, isAdmin } = useAuth();
  const { user: staffUser } = useStaffAuth();

  // Determine submitter info based on who is logged in
  const getSubmitterInfo = () => {
    if (brainUser) {
      return {
        submitter_name: brainUser.user_metadata?.full_name || brainUser.email || "Unknown User",
        submitter_email: brainUser.email || "",
        submitter_type: isAdmin ? "admin" : "owner",
        agency_id: null,
        agency_name: null,
        user_id: brainUser.id,
        staff_member_id: null,
      };
    } else if (staffUser) {
      return {
        submitter_name: staffUser.display_name || staffUser.username,
        submitter_email: staffUser.email || `${staffUser.username}@staff.local`,
        submitter_type: "staff" as const,
        agency_id: staffUser.agency_id,
        agency_name: null,
        user_id: null,
        staff_member_id: staffUser.id,
      };
    }
    return null;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
    }));
    setPendingFiles((prev) => [...prev, ...newFiles].slice(0, 5)); // Max 5 files
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5 - pendingFiles.length,
    disabled: pendingFiles.length >= 5,
  });

  const removeFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadFiles = async (): Promise<string[]> => {
    if (pendingFiles.length === 0) return [];

    const urls: string[] = [];
    const userId = brainUser?.id || staffUser?.id || "anonymous";

    for (let i = 0; i < pendingFiles.length; i++) {
      const { file, id } = pendingFiles[i];
      setUploadProgress(`Uploading file ${i + 1} of ${pendingFiles.length}...`);

      const fileExt = file.name.split(".").pop();
      const fileName = `support-tickets/${userId}/${Date.now()}-${id}.${fileExt}`;

      const { error } = await supabase.storage
        .from("uploads")
        .upload(fileName, file);

      if (error) {
        console.error("Upload error:", error);
        throw new Error(`Failed to upload ${file.name}`);
      }

      const { data: urlData } = supabase.storage
        .from("uploads")
        .getPublicUrl(fileName);

      urls.push(urlData.publicUrl);
    }

    return urls;
  };

  const handleSubmit = async () => {
    const submitterInfo = getSubmitterInfo();

    if (!submitterInfo) {
      toast({
        title: "Not signed in",
        description: "Please sign in to submit a support ticket.",
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please describe the issue you're experiencing.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload files first
      const attachmentUrls = await uploadFiles();
      setUploadProgress(null);

      // Get browser info
      const browserInfo = `${navigator.userAgent} | ${window.innerWidth}x${window.innerHeight}`;

      // Submit ticket via edge function
      const { data, error } = await supabase.functions.invoke("submit-support-ticket", {
        body: {
          description: description.trim(),
          attachment_urls: attachmentUrls,
          page_url: window.location.href,
          browser_info: browserInfo,
          ...submitterInfo,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to submit ticket");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Ticket submitted",
        description: "We've received your feedback and will review it soon.",
      });

      // Reset form and close modal
      setDescription("");
      setPendingFiles([]);
      onOpenChange(false);

    } catch (error) {
      console.error("Submit error:", error);
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const submitterInfo = getSubmitterInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>
            Describe what's happening and we'll look into it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {!submitterInfo && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please sign in to submit a support ticket.
              </AlertDescription>
            </Alert>
          )}

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              What's happening?
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue you're experiencing..."
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Attachments (optional)
            </label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : pendingFiles.length >= 5
                  ? "border-muted bg-muted/5 cursor-not-allowed"
                  : "border-muted-foreground/25 hover:border-primary hover:bg-primary/5"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              {pendingFiles.length >= 5 ? (
                <p className="text-sm text-muted-foreground">Maximum 5 files</p>
              ) : isDragActive ? (
                <p className="text-sm text-muted-foreground">Drop files here...</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Drop files here or click to upload (images, PDFs, text)
                </p>
              )}
            </div>

            {/* Pending files list */}
            {pendingFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {pendingFiles.map(({ file, id }) => (
                  <div
                    key={id}
                    className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={() => removeFile(id)}
                      disabled={isSubmitting}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Context info */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
            <p className="font-medium mb-1">We'll automatically include:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Current page URL</li>
              <li>Your account info</li>
              <li>Browser/device info</li>
            </ul>
          </div>

          {/* Submit button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !submitterInfo || !description.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadProgress || "Submitting..."}
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
