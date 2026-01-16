import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart3, Plus, Trash2, AlertTriangle, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { scorecardsApi } from "@/lib/scorecardsApi";

interface KPIData {
  id: string;
  agency_id: string;
  key: string;
  label: string;
  type: 'number' | 'currency' | 'percentage' | 'integer';
  color?: string;
  is_active: boolean;
  enabled: boolean;
  value?: number;
  role?: string | null;
}

interface EnhancedKPIConfigDialogProps {
  title: string;
  type: "sales" | "service";
  children: React.ReactNode;
  agencyId?: string;
  isStaffMode?: boolean;
}

export function EnhancedKPIConfigDialog({ title, type, children, agencyId, isStaffMode = false }: EnhancedKPIConfigDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [kpis, setKpis] = useState<KPIData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAvailable, setShowAvailable] = useState(true);
  const [deletingKpi, setDeletingKpi] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    kpi: KPIData;
    impact: {
      forms_affected: number;
      affected_form_names: string[];
      rules_touched: boolean;
      remaining_kpis: number;
    };
  } | null>(null);

  const normalizedRole = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() as 'Sales' | 'Service';

  useEffect(() => {
    if (isOpen && agencyId) {
      loadKPIsAndTargets();
    }
  }, [isOpen, agencyId]);

  const loadKPIsAndTargets = async () => {
    if (!agencyId) return;

    try {
      setLoading(true);

      if (isStaffMode) {
        // Use edge function for staff mode
        const [rulesResult, kpisResult] = await Promise.all([
          scorecardsApi.scorecardRulesGet(normalizedRole),
          scorecardsApi.kpisListForRole(normalizedRole)
        ]);

        if (rulesResult.error) throw new Error(rulesResult.error);
        if (kpisResult.error) throw new Error(kpisResult.error);

        const selectedMetrics = new Set(rulesResult.data?.selected_metrics || []);
        const targets = rulesResult.data?.targets || [];

        const kpisWithState: KPIData[] = (kpisResult.data || []).map((kpi: any) => ({
          ...kpi,
          type: (kpi.type as 'number' | 'currency' | 'percentage' | 'integer') || 'number',
          enabled: selectedMetrics.has(kpi.key),
          value: targets.find((t: any) => t.metric_key === kpi.key)?.value_number || 0
        }));

        setKpis(kpisWithState);
      } else {
        // Owner mode - direct Supabase queries
        const { data: scorecardRules, error: rulesError } = await supabase
          .from('scorecard_rules')
          .select('selected_metrics')
          .eq('agency_id', agencyId)
          .eq('role', normalizedRole)
          .single();

        if (rulesError && rulesError.code !== 'PGRST116') {
          console.error('Error loading scorecard rules:', rulesError);
        }

        const selectedMetrics = new Set(scorecardRules?.selected_metrics || []);

        const { data: kpisData, error: kpisError } = await supabase
          .from('kpis')
          .select('*')
          .eq('agency_id', agencyId)
          .eq('is_active', true)
          .or(`role.eq.${normalizedRole},role.is.null`)
          .order('label');

        if (kpisError) throw kpisError;

        const kpiKeys = (kpisData || []).map(k => k.key);
        const { data: targets, error: targetsError } = await supabase
          .from('targets')
          .select('metric_key, value_number')
          .eq('agency_id', agencyId)
          .in('metric_key', kpiKeys)
          .is('team_member_id', null);

        if (targetsError) throw targetsError;

        const kpisWithState: KPIData[] = (kpisData || []).map(kpi => ({
          ...kpi,
          type: (kpi.type as 'number' | 'currency' | 'percentage' | 'integer') || 'number',
          enabled: selectedMetrics.has(kpi.key),
          value: targets?.find(t => t.metric_key === kpi.key)?.value_number || 0,
          role: kpi.role
        }));

        // Deduplicate: prefer role-specific KPIs over NULL role KPIs
        // This ensures editing updates the role-specific row, not the shared NULL row
        const deduplicatedKpis = kpisWithState.reduce((acc, kpi) => {
          const existingIndex = acc.findIndex(k => k.key === kpi.key);
          if (existingIndex === -1) {
            // No existing KPI with this key, add it
            acc.push(kpi);
          } else if (kpi.role === normalizedRole && acc[existingIndex].role === null) {
            // Replace NULL role KPI with role-specific KPI
            acc[existingIndex] = kpi;
          }
          // If existing is role-specific and new is NULL, keep the role-specific one
          return acc;
        }, [] as KPIData[]);

        setKpis(deduplicatedKpis);
      }
    } catch (error) {
      console.error('Error loading KPIs and targets:', error);
      toast.error('Failed to load KPI data');
    } finally {
      setLoading(false);
    }
  };

  const toggleKpi = (key: string) => {
    setKpis(prev => prev.map(kpi => 
      kpi.key === key ? { ...kpi, enabled: !kpi.enabled } : kpi
    ));
  };

  const handleDeleteKpi = async (kpi: KPIData) => {
    if (!agencyId) return;

    try {
      setDeletingKpi(kpi.key);

      const remainingCount = kpis.filter(k => k.key !== kpi.key && k.enabled).length;
      
      if (remainingCount === 0) {
        toast.error("Cannot delete the last enabled KPI.");
        return;
      }

      // LAYER 2: Actually query for affected forms instead of hardcoding 0
      const { data: affectedForms } = await supabase
        .from('form_templates')
        .select('id, name')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .ilike('schema_json::text', `%"${kpi.key}"%`);

      const impact = {
        forms_affected: affectedForms?.length || 0,
        affected_form_names: affectedForms?.map(f => f.name) || [],
        rules_touched: true,
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

      if (isStaffMode) {
        // Staff mode uses edge function
        const result = await scorecardsApi.deleteKpi(deleteConfirm.kpi.key);
        if (result.error) throw new Error(result.error);
      } else {
        // Owner mode uses direct edge function call
        const response = await supabase.functions.invoke('delete_kpi', {
          body: {
            agency_id: agencyId,
            kpi_key: deleteConfirm.kpi.key
          }
        });
        if (response.error) throw response.error;
      }

      toast.success(`KPI "${deleteConfirm.kpi.label}" has been deleted successfully`);
      setDeleteConfirm(null);
      await loadKPIsAndTargets();
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
      const enabledKpis = kpis.filter(k => k.enabled);
      const enabledKeys = enabledKpis.map(k => k.key);

      if (enabledKeys.length === 0) {
        toast.error("You must have at least one KPI enabled");
        setLoading(false);
        return;
      }

      if (isStaffMode) {
        // Staff mode - use edge functions
        const rulesResult = await scorecardsApi.scorecardRulesUpsert(normalizedRole, {
          selected_metrics: enabledKeys
        });
        if (rulesResult.error) throw new Error(rulesResult.error);

        const targets = enabledKpis.map(kpi => ({
          metric_key: kpi.key,
          value_number: kpi.value || 0
        }));
        const targetsResult = await scorecardsApi.targetsReplaceForRole(normalizedRole, targets);
        if (targetsResult.error) throw new Error(targetsResult.error);
      } else {
        // Owner mode - direct Supabase
        const { error: rulesError } = await supabase
          .from('scorecard_rules')
          .update({ selected_metrics: enabledKeys })
          .eq('agency_id', agencyId)
          .eq('role', normalizedRole);

        if (rulesError) throw rulesError;

        const allKpiKeys = kpis.map(k => k.key);
        await supabase
          .from('targets')
          .delete()
          .eq('agency_id', agencyId)
          .is('team_member_id', null)
          .in('metric_key', allKpiKeys);

        const targetsToInsert = enabledKpis.map(kpi => ({
          agency_id: agencyId,
          metric_key: kpi.key,
          value_number: kpi.value || 0,
          team_member_id: null
        }));

        if (targetsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('targets')
            .insert(targetsToInsert);

          if (insertError) throw insertError;
        }
      }

      toast.success(`${normalizedRole} KPI configuration saved!`);
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error("Failed to save configuration");
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
      setLoading(true);
      const newKpiKey = `custom_${Date.now()}`;
      
      if (isStaffMode) {
        // Staff mode - use edge function
        const result = await scorecardsApi.kpisCreateCustom(normalizedRole, "New Custom KPI", "number");
        if (result.error) throw new Error(result.error);
      } else {
        // Owner mode - direct Supabase
        const { error: kpiError } = await supabase
          .from('kpis')
          .insert({
            agency_id: agencyId,
            key: newKpiKey,
            label: "New Custom KPI",
            type: "number",
            is_active: true,
            role: normalizedRole
          });

        if (kpiError) throw kpiError;

        const { data: currentRules } = await supabase
          .from('scorecard_rules')
          .select('selected_metrics')
          .eq('agency_id', agencyId)
          .eq('role', normalizedRole)
          .single();

        const currentMetrics = currentRules?.selected_metrics || [];
        
        const { error: updateError } = await supabase
          .from('scorecard_rules')
          .update({ selected_metrics: [...currentMetrics, newKpiKey] })
          .eq('agency_id', agencyId)
          .eq('role', normalizedRole);

        if (updateError) throw updateError;
      }

      await loadKPIsAndTargets();
      toast.success("Custom KPI added and enabled");
    } catch (error) {
      console.error('Error adding custom KPI:', error);
      toast.error("Failed to add custom KPI");
    } finally {
      setLoading(false);
    }
  };

  const updateKPILabelLocal = (kpiId: string, label: string) => {
    setKpis(prev => prev.map(kpi => 
      kpi.id === kpiId ? { ...kpi, label } : kpi
    ));
  };

  const saveKPILabelToDatabase = async (kpiId: string, label: string) => {
    try {
      if (isStaffMode) {
        const result = await scorecardsApi.kpisUpdateLabel(kpiId, label);
        if (result.error) throw new Error(result.error);
      } else {
        const { error } = await supabase
          .from('kpis')
          .update({ label })
          .eq('id', kpiId);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating KPI label:', error);
      toast.error("Failed to save KPI label");
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const enabledKpis = kpis.filter(k => k.enabled);
  const availableKpis = kpis.filter(k => !k.enabled);

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
                {normalizedRole}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enable KPIs and set daily targets for {type} team members.
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* ENABLED KPIs Section */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Enabled KPIs ({enabledKpis.length})
                  </h3>
                  
                  {enabledKpis.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No KPIs enabled. Select from available KPIs below.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {enabledKpis.map((kpi) => (
                        <Card key={kpi.id} className="border-green-500/30 bg-green-500/5">
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={true}
                                onCheckedChange={() => toggleKpi(kpi.key)}
                                className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                              />
                              <div className="flex-1 min-w-0">
                                <Input
                                  value={kpi.label}
                                  onChange={(e) => updateKPILabelLocal(kpi.id, e.target.value)}
                                  onBlur={(e) => saveKPILabelToDatabase(kpi.id, e.target.value)}
                                  className="h-8 text-sm font-medium"
                                  placeholder="KPI Name"
                                />
                              </div>
                              <div className="w-20 shrink-0">
                                <Input
                                  type="number"
                                  value={kpi.value || 0}
                                  onChange={(e) => updateKPIValue(kpi.key, e.target.value)}
                                  onFocus={handleInputFocus}
                                  className="text-center h-8"
                                  min="0"
                                  placeholder="Target"
                                />
                              </div>
                              {kpi.key.startsWith('custom_') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteKpi(kpi)}
                                  disabled={deletingKpi === kpi.key}
                                  className="text-destructive hover:text-destructive shrink-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* AVAILABLE KPIs Section */}
                <div className="space-y-2">
                  <button
                    onClick={() => setShowAvailable(!showAvailable)}
                    className="w-full text-sm font-medium flex items-center justify-between py-1 hover:text-primary transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      Available to Add ({availableKpis.length})
                    </span>
                    {showAvailable ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  
                  {showAvailable && availableKpis.length > 0 && (
                    <div className="space-y-1">
                      {availableKpis.map((kpi) => (
                        <div
                          key={kpi.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => toggleKpi(kpi.key)}
                        >
                          <Checkbox
                            checked={false}
                            onCheckedChange={() => toggleKpi(kpi.key)}
                          />
                          <span className="text-sm">{kpi.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {showAvailable && availableKpis.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2 text-center">
                      All KPIs are enabled
                    </p>
                  )}
                </div>

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
                {loading ? "Saving..." : "Save Configuration"}
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
                {deleteConfirm && deleteConfirm.impact.forms_affected > 0 ? (
                  <>
                    <div className="bg-destructive/10 border border-destructive rounded-md p-3">
                      <p className="font-semibold text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        STOP - This KPI is actively being used
                      </p>
                    </div>
                    <p>
                      <strong>"{deleteConfirm.kpi.label}"</strong> is currently used in these forms:
                    </p>
                    <ul className="list-disc ml-6 font-medium">
                      {deleteConfirm.impact.affected_form_names.map(name => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                    <p className="text-destructive font-medium">
                      If you delete this KPI, team members will NOT be able to submit these forms until you fix them.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      To safely delete: First edit the forms above to remove or replace this KPI, then come back and delete it.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      This will archive <strong>"{deleteConfirm?.kpi.label}"</strong>. 
                      Historical data will be preserved. No active forms use this KPI.
                    </p>
                    <div className="bg-muted p-3 rounded-md space-y-2">
                      <h4 className="font-medium text-sm">Impact:</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Remaining enabled KPIs: {deleteConfirm?.impact.remaining_kpis}</li>
                        <li>• Scorecard rules will be updated</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteKpi} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConfirm?.impact.forms_affected ? deleteConfirm.impact.forms_affected > 0 : false}
            >
              {deleteConfirm?.impact.forms_affected && deleteConfirm.impact.forms_affected > 0 
                ? "Cannot Delete - Forms Using This KPI" 
                : "Delete KPI"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
