import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface FileUploadProps {
  onUploadComplete?: (files: UploadedFile[]) => void;
  allowedTypes?: string[];
  maxSize?: number;
  maxFiles?: number;
  category?: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onUploadComplete,
  allowedTypes = ['.csv', '.xls', '.xlsx', '.pdf', '.txt', '.doc', '.docx'],
  maxSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 5,
  category = 'general'
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to upload files",
        variant: "destructive",
      });
      return;
    }

    const newErrors: string[] = [];
    
    // Handle rejected files
    rejectedFiles.forEach(({ file, errors }) => {
      errors.forEach((error: any) => {
        if (error.code === 'file-too-large') {
          newErrors.push(`${file.name}: File too large (max ${maxSize / 1024 / 1024}MB)`);
        } else if (error.code === 'file-invalid-type') {
          newErrors.push(`${file.name}: Invalid file type (allowed: ${allowedTypes.join(', ')})`);
        } else {
          newErrors.push(`${file.name}: ${error.message}`);
        }
      });
    });

    // Check total files limit
    if (uploadedFiles.length + acceptedFiles.length > maxFiles) {
      newErrors.push(`Maximum ${maxFiles} files allowed`);
    }

    setErrors(newErrors);

    if (acceptedFiles.length === 0) return;

    setUploading(true);

    try {
      const uploadPromises = acceptedFiles.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${category}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('uploads')
          .upload(fileName, file);

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('uploads')
          .getPublicUrl(fileName);

        // Save file info to database
        const { error: dbError } = await supabase
          .from('uploads')
          .insert({
            user_id: user.id,
            original_name: file.name,
            file_path: fileName,
            file_size: file.size,
            mime_type: file.type,
            category: category
          });

        if (dbError) throw dbError;

        return {
          id: data.path,
          name: file.name,
          size: file.size,
          type: file.type,
          url: publicUrl
        };
      });

      const results = await Promise.all(uploadPromises);
      const newUploadedFiles = [...uploadedFiles, ...results];
      
      setUploadedFiles(newUploadedFiles);
      onUploadComplete?.(newUploadedFiles);
      
      toast({
        title: "Upload successful",
        description: `${acceptedFiles.length} file(s) uploaded successfully`,
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }, [user, uploadedFiles, maxFiles, maxSize, allowedTypes, category, onUploadComplete, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: allowedTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize,
    maxFiles: maxFiles - uploadedFiles.length,
    disabled: uploading || uploadedFiles.length >= maxFiles
  });

  const removeFile = async (fileId: string) => {
    try {
      // Remove from storage
      const { error: storageError } = await supabase.storage
        .from('uploads')
        .remove([fileId]);

      if (storageError) throw storageError;

      // Remove from database
      const { error: dbError } = await supabase
        .from('uploads')
        .delete()
        .eq('file_path', fileId);

      if (dbError) throw dbError;

      // Update local state
      const updatedFiles = uploadedFiles.filter(file => file.id !== fileId);
      setUploadedFiles(updatedFiles);
      onUploadComplete?.(updatedFiles);

      toast({
        title: "File removed",
        description: "File has been deleted successfully",
      });
    } catch (error) {
      console.error('Remove file error:', error);
      toast({
        title: "Error",
        description: "Failed to remove file",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : uploading || uploadedFiles.length >= maxFiles
                ? 'border-muted bg-muted/5 cursor-not-allowed'
                : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            
            {uploading ? (
              <p className="text-sm text-muted-foreground">Uploading files...</p>
            ) : uploadedFiles.length >= maxFiles ? (
              <p className="text-sm text-muted-foreground">Maximum files reached ({maxFiles})</p>
            ) : isDragActive ? (
              <p className="text-sm text-muted-foreground">Drop the files here...</p>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Drag & drop files here, or click to select files
                </p>
                <p className="text-xs text-muted-foreground">
                  Supported formats: {allowedTypes.join(', ')} (max {maxSize / 1024 / 1024}MB each)
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {uploadedFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-3">Uploaded Files</h4>
            <div className="space-y-2">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center space-x-2">
                    <File className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FileUpload;