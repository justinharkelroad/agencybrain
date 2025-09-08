import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BarChart3, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supa } from '@/lib/supabase';

interface KPIData {
  id: string;
  agency_id: string;
  key: string;
  label: string;
  type: 'number' | 'currency' | 'percentage' | 'integer';
  color?: string;
  is_active: boolean;
  value?: number; // Current target value
}

interface EnhancedKPIConfigDialogProps {
  title: string;
  type: "sales" | "service";
  children: React.ReactNode;
  agencyId?: string;
}

export function EnhancedKPIConfigDialog({ title, type, children, agencyId }: EnhancedKPIConfigDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [kpis, setKpis] = useState<KPIData[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingKpi, setDeletingKpi] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    kpi: KPIData;
    impact: {
      forms_affected: number;
      rules_touched: boolean;
      remaining_kpis: number;
    };
  } | null>(null);

  // Load KPIs and targets when dialog opens
  useEffect(() => {
    if (isOpen && agencyId) {
      loadKPIsAndTargets();
    }
  }, [isOpen, agencyId]);

  const loadKPIsAndTargets = async () => {
    if (!agencyId) return;
    
    try {
      setLoading(true);

      // First, load scorecard rules to get role-specific selected_metrics
      const { data: scorecardRules, error: rulesError } = await supa
        .from('scorecard_rules')
        .select('selected_metrics')
        .eq('agency_id', agencyId)
        .eq('role', type)
        .single();

      if (rulesError) {
        console.error('Error loading scorecard rules:', rulesError);
        toast.error('Failed to load role configuration');
        return;
      }

      const selectedMetrics = scorecardRules?.selected_metrics || [];
      
      if (selectedMetrics.length === 0) {
        console.warn(`No selected metrics found for ${type} role`);
        setKpis([]);
        return;
      }

      // Load only KPIs that are in the role's selected_metrics
      const { data: kpisData, error: kpisError } = await supa
        .from('kpis')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .in('key', selectedMetrics)
        .order('key');

      if (kpisError) throw kpisError;

      // Load existing targets for role-relevant KPIs only
      const { data: targets, error: targetsError } = await supa
        .from('targets')
        .select('metric_key, value_number')
        .eq('agency_id', agencyId)
        .in('metric_key', selectedMetrics)
        .is('team_member_id', null);

      if (targetsError) throw targetsError;

      // Combine KPI data with target values
      const kpisWithValues = (kpisData || []).map(kpi => ({
        ...kpi,
        value: targets?.find(t => t.metric_key === kpi.key)?.value_number || 0
      }));

      setKpis(kpisWithValues);
    } catch (error) {
      console.error('Error loading KPIs and targets:', error);
      toast.error('Failed to load KPI data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKpi = async (kpi: KPIData) => {
    if (!agencyId) return;

    try {
      setDeletingKpi(kpi.key);

      // Check impact before deletion
      const remainingCount = kpis.filter(k => k.key !== kpi.key).length;
      
      if (remainingCount === 0) {
        toast.error("Cannot delete the last KPI. Each agency must have at least one KPI.");
        return;
      }

      // Mock impact analysis (in real implementation, you'd call an endpoint)
      const impact = {
        forms_affected: 0, // Would be calculated based on form_templates that reference this KPI
        rules_touched: true, // Assume rules will be touched
        remaining_kpis: remainingCount
      };

      setDeleteConfirm({ kpi, impact });
    } catch (error) {
      console.error('Error preparing KPI deletion:', error);
      toast.error('Failed to prepare KPI deletion');
    } finally {
      setDeletingKpi(null);
    }
  };

  const confirmDeleteKpi = async () => {
    if (!deleteConfirm || !agencyId) return;

    try {
      setLoading(true);

      const response = await supa.functions.invoke('delete_kpi', {
        body: {
          agency_id: agencyId,
          kpi_key: deleteConfirm.kpi.key
        }
      });

      if (response.error) throw response.error;

      toast.success(`KPI "${deleteConfirm.kpi.label}" has been deleted successfully`);
      setDeleteConfirm(null);
      await loadKPIsAndTargets(); // Reload the data
    } catch (error) {
      console.error('Error deleting KPI:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete KPI');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!agencyId) {
      toast.error("Agency ID not found");
      return;
    }

    setLoading(true);
    try {
      // Only process KPIs that are in the current role's scope
      const kpiKeys = kpis.map(kpi => kpi.key);
      
      // Delete existing targets for role-relevant KPIs only
      await supa
        .from('targets')
        .delete()
        .eq('agency_id', agencyId)
        .is('team_member_id', null)
        .in('metric_key', kpiKeys);

      // Insert new targets for role-relevant KPIs only
      const targetsToInsert = kpis.map(kpi => ({
        agency_id: agencyId,
        metric_key: kpi.key,
        value_number: kpi.value || 0,
        team_member_id: null
      }));

      const { error } = await supa
        .from('targets')
        .insert(targetsToInsert);

      if (error) throw error;

      toast.success(`${type === "sales" ? "Sales" : "Service"} KPI targets saved!`);
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving targets:', error);
      toast.error("Failed to save targets");
    } finally {
      setLoading(false);
    }
  };

  const updateKPIValue = (key: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setKpis(prev => prev.map(kpi => 
      kpi.key === key ? { ...kpi, value: numValue } : kpi
    ));
  };

  const addCustomKPI = async () => {
    if (!agencyId) return;

    try {
      const newKpiKey = `custom_${Date.now()}`;
      
      // Insert new KPI into database
      const { error } = await supa
        .from('kpis')
        .insert({
          agency_id: agencyId,
          key: newKpiKey,
          label: "New KPI",
          type: "number",
          is_active: true
        });

      if (error) throw error;

      // Reload KPIs
      await loadKPIsAndTargets();
      toast.success("Custom KPI added successfully");
    } catch (error) {
      console.error('Error adding custom KPI:', error);
      toast.error("Failed to add custom KPI");
    }
  };

  const updateKPILabel = async (kpiId: string, label: string) => {
    try {
      const { error } = await supa
        .from('kpis')
        .update({ label })
        .eq('id', kpiId);

      if (error) throw error;

      setKpis(prev => prev.map(kpi => 
        kpi.id === kpiId ? { ...kpi, label } : kpi
      ));
    } catch (error) {
      console.error('Error updating KPI label:', error);
      toast.error("Failed to update KPI label");
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {title}
              <span className="ml-2 px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                {type.toUpperCase()}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure daily targets for {type} team members. These targets are used to calculate daily scores and achievements.
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {kpis.map((kpi) => (
                  <Card key={kpi.id} className="border-muted">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Input
                            value={kpi.label}
                            onChange={(e) => updateKPILabel(kpi.id, e.target.value)}
                            className="font-medium h-8"
                            placeholder="KPI Name"
                          />
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            value={kpi.value || 0}
                            onChange={(e) => updateKPIValue(kpi.key, e.target.value)}
                            onFocus={handleInputFocus}
                            className="text-center"
                            min="0"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteKpi(kpi)}
                          disabled={deletingKpi === kpi.key}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                <Button
                  variant="outline"
                  onClick={addCustomKPI}
                  className="w-full"
                  disabled={loading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom KPI
                </Button>
              </div>
            )}

            <Separator />

            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Saving..." : "Save Targets"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete KPI: {deleteConfirm?.kpi.label}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Are you sure you want to delete this KPI? This action cannot be undone.</p>
                
                {deleteConfirm && (
                  <div className="bg-muted p-3 rounded-md space-y-2">
                    <h4 className="font-medium text-sm">Impact Analysis:</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Forms affected: {deleteConfirm.impact.forms_affected}</li>
                      <li>• Scorecard rules: {deleteConfirm.impact.rules_touched ? 'Will be updated' : 'No changes needed'}</li>
                      <li>• Remaining KPIs: {deleteConfirm.impact.remaining_kpis}</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                      Historical data will be preserved. Only future calculations will be affected.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteKpi}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete KPI
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}