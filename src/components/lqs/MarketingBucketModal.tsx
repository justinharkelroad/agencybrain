import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarketingBucket } from '@/types/lqs';

interface MarketingBucketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucket: MarketingBucket | null; // null = create mode
  onSave: (data: { name: string; commission_rate_percent: number }) => Promise<boolean>;
  loading?: boolean;
}

export const MarketingBucketModal = ({
  open,
  onOpenChange,
  bucket,
  onSave,
  loading = false
}: MarketingBucketModalProps) => {
  const [name, setName] = useState('');
  const [commissionRate, setCommissionRate] = useState<number>(15);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!bucket;

  useEffect(() => {
    if (open) {
      if (bucket) {
        setName(bucket.name);
        setCommissionRate(bucket.commission_rate_percent);
      } else {
        setName('');
        setCommissionRate(15);
      }
      setError(null);
    }
  }, [open, bucket]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Bucket name is required');
      return;
    }

    if (commissionRate < 0 || commissionRate > 100) {
      setError('Commission rate must be between 0 and 100');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const success = await onSave({
        name: name.trim(),
        commission_rate_percent: commissionRate
      });

      if (success) {
        onOpenChange(false);
      } else {
        setError('Failed to save bucket');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bucket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Marketing Bucket' : 'Add Marketing Bucket'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bucket-name">Bucket Name</Label>
              <Input
                id="bucket-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Internet Leads"
                disabled={saving || loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="commission-rate">
                Average Commission Rate (%)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="commission-rate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                  disabled={saving || loading}
                  className="w-24"
                />
                <span className="text-muted-foreground text-sm">
                  Used for ROI calculations
                </span>
              </div>
            </div>

            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving || loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || loading}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Bucket'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
