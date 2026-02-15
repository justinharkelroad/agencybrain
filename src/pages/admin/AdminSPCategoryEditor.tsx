import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, Loader2, Users, Building2, Briefcase, UserCog, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

const EMOJI_OPTIONS = ['📚', '🎯', '💼', '🚀', '⭐', '🔥', '💡', '📈', '🎓', '🏆', '📊', '🤝', '💪', '🧠'];

const ACCESS_TIER_OPTIONS = [
  { value: 'boardroom', label: 'Boardroom', icon: <Building2 className="h-4 w-4" />, description: 'Boardroom agency owners' },
  { value: 'one_on_one', label: '1:1 Coaching', icon: <Briefcase className="h-4 w-4" />, description: '1:1 Coaching agency owners' },
  { value: 'staff', label: 'All Staff', icon: <Users className="h-4 w-4" />, description: 'All staff members' },
  { value: 'manager', label: 'Managers Only', icon: <UserCog className="h-4 w-4" />, description: 'Staff with Manager or Owner role only' },
];

export default function AdminSPCategoryEditor() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const isNew = !categoryId || categoryId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📚');
  const [accessTiers, setAccessTiers] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isNew && categoryId) {
      loadCategory(categoryId);
    }
  }, [categoryId, isNew]);

  const loadCategory = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sp_categories')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setName(data.name || '');
      setSlug(data.slug || '');
      setDescription(data.description || '');
      setIcon(data.icon || '📚');
      setAccessTiers(data.access_tiers || []);
      setImageUrl(data.image_url || null);
    } catch (err) {
      console.error('Error loading category:', err);
      toast.error('Error loading category');
      navigate('/admin/standard-playbook');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (isNew) {
      setSlug(generateSlug(value));
    }
  };

  const toggleTier = (tier: string) => {
    setAccessTiers(prev =>
      prev.includes(tier)
        ? prev.filter(t => t !== tier)
        : [...prev, tier]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!slug.trim()) {
      toast.error('Slug is required');
      return;
    }
    if (accessTiers.length === 0) {
      toast.error('Select at least one access tier');
      return;
    }

    setSaving(true);
    try {
      const categoryData = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        icon,
        access_tiers: accessTiers,
        image_url: imageUrl,
      };

      if (isNew) {
        const { error } = await supabase
          .from('sp_categories')
          .insert(categoryData);

        if (error) {
          if (error.code === '23505') {
            toast.error('A category with this slug already exists');
            return;
          }
          throw error;
        }

        toast.success('Category created!');
      } else {
        const { error } = await supabase
          .from('sp_categories')
          .update(categoryData)
          .eq('id', categoryId);

        if (error) throw error;

        toast.success('Category saved!');
      }

      navigate('/admin/standard-playbook');
    } catch (err) {
      console.error('Error saving category:', err);
      toast.error('Error saving category');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/standard-playbook')}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Back to Standard Playbook
          </Button>
          <h1 className="text-2xl font-medium">
            {isNew ? 'New Category' : `Edit: ${name}`}
          </h1>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" strokeWidth={1.5} />
          )}
          {saving ? 'Saving...' : 'Save Category'}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="e.g., Standard Playbook"
                className="mt-1"
              />
            </div>

            {/* Slug */}
            <div>
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="e.g., standard-playbook"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL-safe identifier (lowercase, no spaces)
              </p>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of this training category"
                className="mt-1"
                rows={2}
              />
            </div>

            {/* Icon */}
            <div>
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`w-10 h-10 text-xl rounded-lg border transition-all ${
                      icon === emoji
                        ? 'border-primary bg-primary/10'
                        : 'border-border/50 hover:border-border'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Cover Image */}
            <div>
              <Label>Cover Image</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Recommended: 1200 × 400 pixels (3:1 ratio)
              </p>
              {imageUrl ? (
                <div className="relative rounded-lg border border-border overflow-hidden">
                  <img
                    src={imageUrl}
                    alt="Category cover"
                    className="w-full aspect-[3/1] object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => setImageUrl(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="w-full aspect-[3/1] rounded-lg border-2 border-dashed border-border/50 hover:border-border flex flex-col items-center justify-center gap-2 text-muted-foreground transition-colors"
                >
                  {uploadingImage ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6" />
                      <span className="text-sm">Upload cover image</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  setUploadingImage(true);
                  try {
                    const ext = file.name.split('.').pop() || 'png';
                    const id = isNew ? crypto.randomUUID() : categoryId;
                    const path = `category-images/${id}.${ext}`;

                    const { error: uploadError } = await supabase.storage
                      .from('training-assets')
                      .upload(path, file, { upsert: true });

                    if (uploadError) throw uploadError;

                    const { data: publicUrlData } = supabase.storage
                      .from('training-assets')
                      .getPublicUrl(path);

                    setImageUrl(`${publicUrlData.publicUrl}?t=${Date.now()}`);
                    toast.success('Image uploaded');
                  } catch (err) {
                    console.error('Image upload error:', err);
                    toast.error('Failed to upload image');
                  } finally {
                    setUploadingImage(false);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Access Control */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Access Control</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Select who can access this training category. You can select multiple tiers.
            </p>

            <div className="space-y-3">
              {ACCESS_TIER_OPTIONS.map(tier => (
                <label
                  key={tier.value}
                  className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                    accessTiers.includes(tier.value)
                      ? 'border-primary bg-primary/5'
                      : 'border-border/50 hover:border-border'
                  }`}
                >
                  <Checkbox
                    checked={accessTiers.includes(tier.value)}
                    onCheckedChange={() => toggleTier(tier.value)}
                  />
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                      {tier.icon}
                    </div>
                    <div>
                      <p className="font-medium">{tier.label}</p>
                      <p className="text-sm text-muted-foreground">{tier.description}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
