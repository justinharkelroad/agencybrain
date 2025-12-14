import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TransferInputs, TransferDerived } from '@/utils/marketingCalculator';

interface SaveLiveTransferReportButtonProps {
  inputs: TransferInputs;
  derived: TransferDerived;
  disabled?: boolean;
}

export const SaveLiveTransferReportButton = ({ inputs, derived, disabled }: SaveLiveTransferReportButtonProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const canSave = inputs.liveTransferSource && inputs.spend > 0 && derived.totalTransfers > 0;

  const handleSave = async () => {
    if (!canSave) return;
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (!profile?.agency_id) throw new Error('No agency found');

      const title = `${inputs.liveTransferSource} - ${new Date().toLocaleDateString()}`;
      
      const { error } = await supabase.from('saved_reports').insert({
        agency_id: profile.agency_id,
        user_id: user.id,
        report_type: 'live_transfer',
        title,
        input_data: inputs as unknown as Record<string, unknown>,
        results_data: derived as unknown as Record<string, unknown>,
      });

      if (error) throw error;

      setSaved(true);
      toast.success('Report saved to Reports tab');
      
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Could not save report. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Button
      onClick={handleSave}
      disabled={disabled || !canSave || isSaving || saved}
      variant="outline"
      className="gap-2"
    >
      {isSaving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saved ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {saved ? 'Saved!' : 'Save to Reports'}
    </Button>
  );
};

export default SaveLiveTransferReportButton;
