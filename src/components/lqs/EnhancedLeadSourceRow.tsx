import { useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, DollarSign, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { LeadSourceExtended, MarketingBucket, CostType } from '@/types/lqs';
import { COST_TYPE_LABELS } from './index';

interface EnhancedLeadSourceRowProps {
  source: LeadSourceExtended;
  buckets: MarketingBucket[];
  index: number;
  totalCount: number;
  onUpdate: (id: string, updates: Partial<LeadSourceExtended>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, direction: 'up' | 'down') => Promise<void>;
  onManageSpend: (source: LeadSourceExtended) => void;
  loading?: boolean;
}

export const EnhancedLeadSourceRow = ({
  source,
  buckets,
  index,
  totalCount,
  onUpdate,
  onDelete,
  onMove,
  onManageSpend,
  loading = false,
}: EnhancedLeadSourceRowProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(source.name);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleNameSave = async () => {
    if (editedName.trim() && editedName !== source.name) {
      await onUpdate(source.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setEditedName(source.name);
    setIsEditingName(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(source.id);
    setIsDeleting(false);
  };

  const handleBucketChange = async (bucketId: string) => {
    const newBucketId = bucketId === 'unassigned' ? null : bucketId;
    await onUpdate(source.id, { bucket_id: newBucketId });
  };

  const handleCostTypeChange = async (costType: string) => {
    await onUpdate(source.id, { cost_type: costType as CostType });
  };

  const handleSelfGenChange = async (checked: boolean) => {
    await onUpdate(source.id, { is_self_generated: checked });
  };

  const handleActiveChange = async (checked: boolean) => {
    await onUpdate(source.id, { is_active: checked });
  };

  return (
    <div className="flex items-center gap-2 p-3 border rounded-lg bg-card">
      {/* Reorder Buttons */}
      <div className="flex flex-col gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={() => onMove(source.id, 'up')}
          disabled={index === 0 || loading}
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={() => onMove(source.id, 'down')}
          disabled={index === totalCount - 1 || loading}
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
      </div>

      {/* Name (Editable) */}
      <div className="flex-1 min-w-[120px]">
        {isEditingName ? (
          <div className="flex items-center gap-1">
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') handleNameCancel();
              }}
            />
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleNameSave}>
              <Check className="h-3 w-3 text-green-600" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleNameCancel}>
              <X className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className={`text-sm ${!source.is_active ? 'text-muted-foreground line-through' : ''}`}>
              {source.name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 opacity-50 hover:opacity-100"
              onClick={() => setIsEditingName(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Bucket Assignment */}
      <Select
        value={source.bucket_id || 'unassigned'}
        onValueChange={handleBucketChange}
        disabled={loading}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Select bucket" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {buckets.map((bucket) => (
            <SelectItem key={bucket.id} value={bucket.id}>
              {bucket.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Self-Generated Toggle */}
      <div className="flex items-center gap-1.5">
        <Checkbox
          id={`self-gen-${source.id}`}
          checked={source.is_self_generated}
          onCheckedChange={handleSelfGenChange}
          disabled={loading}
        />
        <label htmlFor={`self-gen-${source.id}`} className="text-xs text-muted-foreground cursor-pointer">
          Self-Gen
        </label>
      </div>

      {/* Cost Type */}
      <Select
        value={source.cost_type}
        onValueChange={handleCostTypeChange}
        disabled={loading}
      >
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(COST_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Manage Spend Button */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => onManageSpend(source)}
        disabled={loading}
      >
        <DollarSign className="h-3 w-3 mr-1" />
        Spend
      </Button>

      {/* Active Toggle */}
      <div className="flex items-center gap-1.5">
        <Switch
          checked={source.is_active}
          onCheckedChange={handleActiveChange}
          disabled={loading}
        />
        <span className="text-xs text-muted-foreground">Active</span>
      </div>

      {/* Delete */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
        onClick={handleDelete}
        disabled={loading || isDeleting}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};
