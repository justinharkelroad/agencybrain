import { useState, useMemo } from 'react';
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
import { Loader2 } from 'lucide-react';

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

interface MoveToQuotedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (products: string[]) => void;
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
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

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

  const toggleProduct = (product: string) => {
    setSelectedProducts(prev =>
      prev.includes(product)
        ? prev.filter(p => p !== product)
        : [...prev, product]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedProducts);
    setSelectedProducts([]);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedProducts([]);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-yellow-600 dark:text-yellow-400">
            Move to Quoted — Select Products
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Which products are being quoted?
          </p>
          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
            {productOptions.map(product => (
              <label
                key={product}
                className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selectedProducts.includes(product)}
                  onCheckedChange={() => toggleProduct(product)}
                />
                <span className="text-sm">{product}</span>
              </label>
            ))}
          </div>
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
            disabled={selectedProducts.length === 0 || loading}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm ({selectedProducts.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
