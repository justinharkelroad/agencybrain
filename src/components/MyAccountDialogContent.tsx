import React, { useEffect, useState, useRef } from "react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { supabase } from '@/lib/supabaseClient';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { normalizePersonName } from "@/lib/nameFormatting";

interface MyAccountDialogContentProps {
  onClose: () => void;
  onPhotoUpdate?: (url: string) => void;
}

export function MyAccountDialogContent({ onClose, onPhotoUpdate }: MyAccountDialogContentProps) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName((user?.user_metadata?.full_name as string) || "");
    if (user?.id) {
      supabase
        .from('profiles')
        .select('profile_photo_url')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.profile_photo_url) {
            setPhotoUrl(data.profile_photo_url);
          }
        });
    }
  }, [user?.id]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 2MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_photo_url: urlWithCacheBuster })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setPhotoUrl(urlWithCacheBuster);
      onPhotoUpdate?.(urlWithCacheBuster);
      toast({ title: "Photo updated", description: "Your profile photo has been updated." });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Upload failed", description: e?.message || "Could not upload photo.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    const full_name = normalizePersonName(name);
    if (!full_name) {
      toast({ title: "Name required", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Update auth user metadata
      const { error: authError } = await supabase.auth.updateUser({ data: { full_name } });
      if (authError) throw authError;
      
      // Also update the profiles table so Exchange posts show the name
      if (user?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name })
          .eq('id', user.id);
        if (profileError) throw profileError;
      }
      
      toast({ title: "Saved", description: "Account updated successfully." });
      onClose();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Update failed", description: e?.message || "Could not update account.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const userInitials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0].toUpperCase() || '??';

  return (
    <>
      <DialogHeader>
        <DialogTitle>My Account</DialogTitle>
        <DialogDescription>Manage your profile and preferences</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex justify-center">
          <div className="relative group">
            <Avatar className="h-24 w-24">
              {photoUrl && <AvatarImage src={photoUrl} alt={name || "Profile"} />}
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">Click to upload a profile photo</p>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="name" className="text-right">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="email" className="text-right">Email</Label>
          <Input id="email" value={user?.email || ""} className="col-span-3" readOnly />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="role" className="text-right">Role</Label>
          <Input id="role" value={isAdmin ? "Admin" : "User"} className="col-span-3" readOnly />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">Theme</Label>
          <div className="col-span-3">
            <ThemeToggle />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button variant="flat" onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
      </div>
    </>
  );
}
