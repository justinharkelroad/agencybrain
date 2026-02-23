import { useState, useRef, useId } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface CoverImageUploadProps {
  imageUrl: string;
  onImageChange: (url: string) => void;
  label?: string;
  maxSizeMb?: number;
}

export function CoverImageUpload({
  imageUrl,
  onImageChange,
  label = 'Cover Image',
  maxSizeMb = 2,
}: CoverImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`Image must be less than ${maxSizeMb}MB`);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `training-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('training-assets')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload image');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('training-assets')
        .getPublicUrl(filePath);

      onImageChange(publicUrl);
      toast.success('Image uploaded');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        {label}
      </Label>

      {imageUrl ? (
        <div className="relative">
          <img
            src={imageUrl}
            alt="Cover"
            className="w-full aspect-[3/1] object-cover rounded-lg"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
            onClick={() => onImageChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            id={inputId}
            disabled={uploading}
          />
          <label
            htmlFor={inputId}
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            {uploading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">
              {uploading ? 'Uploading...' : 'Click to upload cover image'}
            </span>
            <span className="text-xs text-muted-foreground/70">
              PNG, JPG up to {maxSizeMb}MB
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
