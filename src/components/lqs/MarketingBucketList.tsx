import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MarketingBucket, LeadSourceExtended } from '@/types/lqs';
import { MarketingBucketModal } from './MarketingBucketModal';

interface MarketingBucketListProps {
  buckets: MarketingBucket[];
  leadSources: LeadSourceExtended[];
  onCreateBucket: (data: { name: string; commission_rate_percent: number }) => Promise<boolean>;
  onUpdateBucket: (id: string, data: { name: string; commission_rate_percent: number }) => Promise<boolean>;
  onDeleteBucket: (id: string) => Promise<boolean>;
  onReorderBucket: (id: string, direction: 'up' | 'down') => Promise<boolean>;
  loading?: boolean;
}

export const MarketingBucketList = ({
  buckets,
  leadSources,
  onCreateBucket,
  onUpdateBucket,
  onDeleteBucket,
  onReorderBucket,
  loading = false,
}: MarketingBucketListProps) => {
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  const [editingBucket, setEditingBucket] = useState<MarketingBucket | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingBucket, setDeletingBucket] = useState<MarketingBucket | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const toggleExpanded = (bucketId: string) => {
    setExpandedBuckets(prev => {
      const next = new Set(prev);
      if (next.has(bucketId)) {
        next.delete(bucketId);
      } else {
        next.add(bucketId);
      }
      return next;
    });
  };

  const getSourcesForBucket = (bucketId: string) => {
    return leadSources.filter(ls => ls.bucket_id === bucketId);
  };

  const handleDeleteClick = (bucket: MarketingBucket) => {
    const sourcesInBucket = getSourcesForBucket(bucket.id);
    if (sourcesInBucket.length > 0) {
      setDeleteError(`Cannot delete "${bucket.name}" - it has ${sourcesInBucket.length} lead source(s) assigned. Reassign them first.`);
      setDeletingBucket(bucket);
    } else {
      setDeleteError(null);
      setDeletingBucket(bucket);
    }
  };

  const confirmDelete = async () => {
    if (!deletingBucket || deleteError) return;
    
    await onDeleteBucket(deletingBucket.id);
    setDeletingBucket(null);
  };

  const handleSaveBucket = async (data: { name: string; commission_rate_percent: number }) => {
    if (editingBucket) {
      return onUpdateBucket(editingBucket.id, data);
    }
    return onCreateBucket(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Marketing Buckets</h3>
        <Button onClick={() => setShowCreateModal(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Bucket
        </Button>
      </div>

      {buckets.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border rounded-lg">
          <p>No marketing buckets configured yet.</p>
          <p className="text-sm mt-1">Create buckets to group your lead sources for ROI tracking.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {buckets.map((bucket, index) => {
            const isExpanded = expandedBuckets.has(bucket.id);
            const sourcesInBucket = getSourcesForBucket(bucket.id);

            return (
              <div key={bucket.id} className="border rounded-lg overflow-hidden">
                {/* Bucket Header */}
                <div className="flex items-center gap-2 p-3 bg-muted/30">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => toggleExpanded(bucket.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>

                  <span className="font-medium flex-1">{bucket.name}</span>

                  <Badge variant="secondary" className="text-xs">
                    {bucket.commission_rate_percent}% commission
                  </Badge>

                  <Badge variant="outline" className="text-xs">
                    {sourcesInBucket.length} source{sourcesInBucket.length !== 1 ? 's' : ''}
                  </Badge>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => onReorderBucket(bucket.id, 'up')}
                      disabled={index === 0 || loading}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => onReorderBucket(bucket.id, 'down')}
                      disabled={index === buckets.length - 1 || loading}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setEditingBucket(bucket)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteClick(bucket)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Expanded Lead Sources */}
                {isExpanded && (
                  <div className="border-t">
                    {sourcesInBucket.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        No lead sources in this bucket yet.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {sourcesInBucket.map(source => (
                          <div key={source.id} className="px-4 py-2 pl-10 text-sm flex items-center gap-2">
                            <span className={source.is_active ? '' : 'text-muted-foreground line-through'}>
                              {source.name}
                            </span>
                            {source.is_self_generated && (
                              <Badge variant="outline" className="text-xs">Self-Gen</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <MarketingBucketModal
        open={showCreateModal || !!editingBucket}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false);
            setEditingBucket(null);
          }
        }}
        bucket={editingBucket}
        onSave={handleSaveBucket}
        loading={loading}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingBucket} onOpenChange={(open) => !open && setDeletingBucket(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Marketing Bucket</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteError ? (
                <span className="text-destructive">{deleteError}</span>
              ) : (
                <>Are you sure you want to delete "{deletingBucket?.name}"? This action cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {!deleteError && (
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
