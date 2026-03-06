import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const FALLBACK_PRODUCT_OPTIONS = [
  'Standard Auto',
  'Non-Standard Auto',
  'Homeowners',
  'Landlords',
  'Manufactured Home',
  'Renters',
  'Condo',
  'Umbrella',
  'Life',
  'Motorcycle',
  'Boat',
  'RV',
  'Other',
];

export interface QuotedProduct {
  productType: string;
  items: number;
  premiumCents: number;
}

interface ProductEntry {
  productType: string;
  selected: boolean;
  items: string;
  premium: string;
}

interface MoveToQuotedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (products: QuotedProduct[]) => void;
  loading?: boolean;
  agencyId: string;
}

export function MoveToQuotedDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  agencyId,
}: MoveToQuotedDialogProps) {
  const [entries, setEntries] = useState<ProductEntry[]>([]);

  // Fetch active policy types from agency settings
  const { data: dbPolicyTypeNames } = useQuery<string[]>({
    queryKey: ['policy-type-names', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policy_types')
        .select('name')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []).map(pt => pt.name);
    },
    enabled: !!agencyId && open,
  });

  const productOptions = useMemo(
    () => dbPolicyTypeNames && dbPolicyTypeNames.length > 0
      ? [...dbPolicyTypeNames.filter(n => n !== 'Other'), 'Other']
      : FALLBACK_PRODUCT_OPTIONS,
    [dbPolicyTypeNames]
  );

  // Initialize entries when dialog opens (only if not yet populated —
  // avoids wiping user input when productOptions loads after initial render)
  useEffect(() => {
    if (open && entries.length === 0) {
      setEntries(productOptions.map(p => ({ productType: p, selected: false, items: '', premium: '' })));
    }
  }, [open, productOptions]);

  const toggleProduct = (productType: string) => {
    setEntries(prev =>
      prev.map(e => e.productType === productType ? { ...e, selected: !e.selected } : e)
    );
  };

  const updateEntry = (productType: string, field: 'items' | 'premium', value: string) => {
    setEntries(prev =>
      prev.map(e => e.productType === productType ? { ...e, [field]: value } : e)
    );
  };

  const selectedEntries = entries.filter(e => e.selected);

  const hasValidationErrors = selectedEntries.some(e => {
    const items = Number(e.items);
    const premium = Number(e.premium);
    return !items || items <= 0 || !premium || premium <= 0;
  });

  const handleConfirm = () => {
    const products: QuotedProduct[] = selectedEntries.map(e => ({
      productType: e.productType,
      items: Math.max(1, Math.floor(Number(e.items))),
      premiumCents: Math.round(Number(e.premium) * 100),
    }));
    onConfirm(products);
    setEntries([]);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setEntries([]);
    }
    onOpenChange(isOpen);
  };

  const totalItems = selectedEntries.reduce((s, e) => s + (Math.floor(Number(e.items)) || 0), 0);
  const totalPremium = selectedEntries.reduce((s, e) => s + (Number(e.premium) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-yellow-600 dark:text-yellow-400">
            Move to Quoted — Select Products
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Which products are being quoted? Enter items and premium for each.
          </p>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {entries.map(entry => (
              <div
                key={entry.productType}
                className={cn(
                  'rounded-md border p-3 transition-opacity',
                  !entry.selected && 'opacity-60'
                )}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={entry.selected}
                    onCheckedChange={() => toggleProduct(entry.productType)}
                  />
                  <span className="text-sm font-medium">{entry.productType}</span>
                </label>

                {entry.selected && (
                  <div className="grid grid-cols-2 gap-3 mt-2 pl-6">
                    <div>
                      <Label className="text-xs text-muted-foreground">Items</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        value={entry.items}
                        onChange={(e) => updateEntry(entry.productType, 'items', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Premium ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={entry.premium}
                        onChange={(e) => updateEntry(entry.productType, 'premium', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {selectedEntries.length > 0 && (
            <div className="text-sm bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 flex justify-between">
              <span>{selectedEntries.length} {selectedEntries.length === 1 ? 'product' : 'products'}</span>
              <span>{totalItems} items</span>
              <span className="font-medium">${totalPremium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedEntries.length === 0 || hasValidationErrors || loading}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm ({selectedEntries.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
