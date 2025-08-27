import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Clock, Target, RefreshCw, Shield } from "lucide-react";
import inputsSchema from "../bonus_grid_web_spec/schema_inputs.json";
import { SummaryGrid } from "../bonus_grid_web_spec/SummaryGrid";
import { computeRounded, type CellAddr, type WorkbookState } from "../bonus_grid_web_spec/computeWithRounding";
import outputsMap from "../bonus_grid_web_spec/outputs_addresses.json";
import { buildCopyPayload, buildCopyText } from "../bonus_grid_web_spec/copyResults";
import { buildNormalizedState } from "../bonus_grid_web_spec/normalize";
import { BaselineTable } from "../bonus_grid_web_spec/BaselineTable";
import { NewBusinessTable } from "../bonus_grid_web_spec/NewBusinessTable";
import { GrowthBonusFactorsCard } from "../bonus_grid_web_spec/GrowthBonusFactorsCard";
import { InputsForm } from "../bonus_grid_web_spec/InputsForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { getBonusGridState, saveBonusGridState, recoverFromSnapshot, getLatestSnapshotForRecovery, type SaveResult } from "@/lib/bonusGridState";
import { supa } from '@/lib/supabase';
import React from "react";

import { BASELINE_ROWS, NEW_BIZ_ROWS } from "../bonus_grid_web_spec/rows";

const STORAGE_KEY = "bonusGrid:inputs-v1";
const PPI_DEFAULTS: Record<CellAddr, number> = {
  "Sheet1!D9":10,"Sheet1!D10":0,"Sheet1!D11":0,"Sheet1!D12":5,"Sheet1!D13":20,"Sheet1!D14":20,
  "Sheet1!D15":5,"Sheet1!D16":5,"Sheet1!D17":5,"Sheet1!D18":5,"Sheet1!D19":5,"Sheet1!D20":0,
  "Sheet1!D21":0,"Sheet1!D22":0,"Sheet1!D23":10,
  "Sheet1!L9":10,"Sheet1!L10":0,"Sheet1!L11":0,"Sheet1!L12":5,"Sheet1!L13":20,"Sheet1!L14":20,
  "Sheet1!L15":5,"Sheet1!L16":5,"Sheet1!L17":5,"Sheet1!L18":5,"Sheet1!L19":5,"Sheet1!L20":0,
  "Sheet1!L21":0,"Sheet1!L22":0,"Sheet1!L23":10,
};


export default function BonusGridPage(){
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const [state, setState] = useState<Record<CellAddr, any>>({});
  
  // dirty indicator - fixed autosave race
  const [savedSig, setSavedSig] = useState<string | null>(null);
  const [autoSavedSig, setAutoSavedSig] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  

  
  // hydrate once with database support
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Try to get from database first
        const dbState = await getBonusGridState();
        
        if (dbState && Object.keys(dbState).length > 0) {
          setState(dbState);
          setLastSaved(new Date());
        } else {
          // fallback to schema defaults plus PPI defaults
          const base = Object.fromEntries(
            (inputsSchema as any).all_fields.map((f: any) => [`${f.sheet}!${f.cell}` as CellAddr, f.default ?? ""])
          );
          const filled = { ...base, ...PPI_DEFAULTS };
          setState(filled);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        // fallback to schema defaults
        const base = Object.fromEntries(
          (inputsSchema as any).all_fields.map((f: any) => [`${f.sheet}!${f.cell}` as CellAddr, f.default ?? ""])
        );
        const filled = { ...base, ...PPI_DEFAULTS };
        setState(filled);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Auto-save to database when state changes
  useEffect(() => {
    if (autoSavedSig === null || isLoading) return; // not ready yet
    
    const saveData = async () => {
      setIsAutoSaving(true);
      setSaveError(null);
      try {
        const result: SaveResult = await saveBonusGridState(state);
        if (result.success) {
          setLastSaved(new Date());
          setAutoSavedSig(JSON.stringify(state)); // Use autoSavedSig instead of savedSig
        } else {
          setSaveError(result.error || 'Unknown save error');
          toast({
            title: "Auto-save failed",
            description: result.error || "Failed to save data automatically. Your data is still safe in local storage.",
            variant: "destructive",
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setSaveError(errorMsg);
        console.error('Auto-save failed:', error);
        toast({
          title: "Auto-save failed",
          description: "Failed to save data automatically. Your data is still safe in local storage.",
          variant: "destructive",
        });
      } finally {
        setIsAutoSaving(false);
      }
    };
    
    const t = setTimeout(saveData, 1000); // Increased debounce for database saves
    return () => clearTimeout(t);
  }, [state, autoSavedSig, isLoading, toast]);

  // set baseline AFTER first hydration settles
  useEffect(() => {
    if (savedSig === null && autoSavedSig === null) {
      const t = setTimeout(() => {
        setSavedSig(JSON.stringify(state));
        setAutoSavedSig(JSON.stringify(state));
      }, 100);
      return () => clearTimeout(t);
    }
  }, [state, savedSig, autoSavedSig]);

  const isDirty = savedSig !== null && JSON.stringify(state) !== savedSig;

  const setField = (addr: CellAddr, val: any) =>
    setState(p => ({ ...p, [addr]: val }));

  // Handle browser beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Block navigation if there are unsaved changes
  useEffect(() => {
    const handleNavigation = (e: PopStateEvent) => {
      if (isDirty) {
        const confirmLeave = window.confirm(
          "You have unsaved changes. Are you sure you want to leave this page?"
        );
        if (!confirmLeave) {
          e.preventDefault();
          window.history.pushState(null, "", window.location.href);
        }
      }
    };

    if (isDirty) {
      window.history.pushState(null, "", window.location.href);
      window.addEventListener('popstate', handleNavigation);
    }

    return () => {
      window.removeEventListener('popstate', handleNavigation);
    };
  }, [isDirty]);

  const outputAddrs = useMemo(()=>(
    [
      ...outputsMap.bonus_percent_preset,
      ...outputsMap.bonus_dollars,
      ...outputsMap.daily_points_needed,
      ...outputsMap.daily_items_needed,
    ] as CellAddr[]
  ), []);

  // All computed addresses for tables
  const allComputedAddrs = useMemo(()=> {
    const baseline = BASELINE_ROWS.flatMap(r => [r.items, r.total, r.loss]); // ADD r.items
    const baselineTotals: CellAddr[] = ["Sheet1!C24","Sheet1!E24","Sheet1!G24"]; // ADD C24, E24
    const newBiz = NEW_BIZ_ROWS.map(r => r.total);                  
    const newBizTotals: CellAddr[] = ["Sheet1!K24","Sheet1!M24","Sheet1!M25"]; // ADD totals
    const gbf: CellAddr[] = ["Sheet1!D30","Sheet1!D31","Sheet1!D32"]; 
    const growthGrid: CellAddr[] = Array.from({ length: 7 }, (_, i) => 38 + i).flatMap(r => ([
      `Sheet1!C${r}`, `Sheet1!D${r}`, `Sheet1!E${r}`, `Sheet1!F${r}`,
      `Sheet1!G${r}`, `Sheet1!H${r}`, `Sheet1!I${r}`, `Sheet1!J${r}`,
      `Sheet1!K${r}`, `Sheet1!L${r}`,
    ] as CellAddr[]));
    return [...outputAddrs, ...baseline, ...baselineTotals, ...newBiz, ...newBizTotals, ...gbf, ...growthGrid, "Sheet1!K45" as CellAddr, "Sheet1!L45" as CellAddr];
  }, [outputAddrs]);

  const outputs = useMemo(()=>{
    const normalized = buildNormalizedState(state, inputsSchema as any);
    return computeRounded({ inputs: normalized } as WorkbookState, outputAddrs);
  }, [state]);

  const allOutputs = useMemo(()=>{
    const normalized = buildNormalizedState(state, inputsSchema as any);
    return computeRounded({ inputs: normalized } as WorkbookState, allComputedAddrs);
  }, [state, allComputedAddrs]);

  // Guard: H rows must be finite numbers (presets) before rendering grid
  useEffect(() => {
    const ok = [38,39,40,41,42,43,44].every(
      r => Number.isFinite(allOutputs[`Sheet1!H${r}` as CellAddr])
    );
    if (ok) setIsHydrated(true);
  }, [allOutputs]);

  // Fail-safe: never stick on Loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isHydrated) {
        console.warn("Forcing hydration after timeout");
        setIsHydrated(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [isHydrated]);

  const copy = () => {
    const normalized = buildNormalizedState(state, inputsSchema as any);
    const payload = buildCopyPayload(normalized, outputs);
    const text = buildCopyText(normalized, outputs);
    navigator.clipboard.writeText(JSON.stringify(payload) + "\n\n" + text);
    toast({
      title: "Results copied!",
      description: "The results have been copied to your clipboard.",
    });
  };

  const handleSave = async () => {
    try {
      setSaveError(null);
      const result: SaveResult = await saveBonusGridState(state);
      if (result.success) {
        setLastSaved(new Date());
        setSavedSig(JSON.stringify(state));
        toast({
          title: "Data saved!",
          description: "Your bonus grid data has been saved securely with integrity verification.",
        });
      } else {
        setSaveError(result.error || 'Unknown save error');
        toast({
          title: "Save failed",
          description: result.error || "Failed to save data. Your data is safe in local storage.",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setSaveError(errorMsg);
      toast({
        title: "Save failed",
        description: "Failed to save data. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const handleReset = async () => { 
    setState({}); 
    try {
      await saveBonusGridState({});
    } catch (error) {
      console.error('Failed to clear database:', error);
    }
    setSavedSig(null);
    setAutoSavedSig(null);
    setLastSaved(null);
    setSaveError(null);
  };

  const handleDataImported = (importedData: Record<CellAddr, any>) => {
    setState(importedData);
    setSavedSig(null); // Mark as dirty so it gets saved
    setAutoSavedSig(null); // Reset auto-save state
    toast({
      title: "Data imported successfully",
      description: "Your bonus grid has been updated with the imported data.",
    });
  };


  const handleReturnToDashboard = () => {
    if (isDirty) {
      const confirmLeave = window.confirm(
        "You have unsaved changes. Are you sure you want to leave this page?"
      );
      if (!confirmLeave) return;
    }
    navigate('/dashboard');
  };

  // Grid validation for Snapshot Planner
  const isGridValid = useMemo(() => {
    // Check if required Growth Goal values (C38-C44) exist and are valid numbers > 0
    const requiredAddrs = [38, 39, 40, 41, 42, 43, 44].map(r => `Sheet1!C${r}` as CellAddr);
    return requiredAddrs.every(addr => {
      const val = state[addr];
      const numVal = Number(val);
      return val !== undefined && val !== null && val !== "" && !isNaN(numVal) && numVal > 0;
    });
  }, [state]);

  const isGridSaved = !isDirty;

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Loading your bonus grid data...</p>
          </div>
        </div>
      )}
      
      {!isLoading && (
        <>
          {/* Navigation Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleReturnToDashboard}>
                <ArrowLeft className="h-4 w-4" />
                Return to Dashboard
              </Button>
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/dashboard">Dashboard</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Bonus Grid</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            
            {/* Save Status with Error Handling */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isAutoSaving ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  Auto-saving...
                </div>
              ) : saveError ? (
                <div className="flex items-center gap-2 text-red-600">
                  <Shield className="h-4 w-4" />
                  Save error: {saveError}
                </div>
              ) : isDirty ? (
                <div className="flex items-center gap-2 text-amber-600">
                  <Clock className="h-4 w-4" />
                  Unsaved changes
                </div>
              ) : lastSaved ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Save className="h-4 w-4" />
                  Saved at {lastSaved.toLocaleTimeString()}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Save className="h-4 w-4" />
                  Ready
                </div>
              )}
            </div>
          </div>

      {/* Prominent Dashboard Header */}
      <div className="relative rounded-2xl border border-border bg-gradient-to-br from-card via-card to-card/80 p-6 shadow-2xl backdrop-blur-sm">
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-transparent to-accent/20 blur-xl -z-10"></div>
        
        {/* Trophy Badge */}
        <div className="absolute -top-3 -right-3 bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900 px-4 py-2 rounded-full text-sm font-bold shadow-lg">
          🏆🏆🏆🏆
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
              Allstate Bonus Grid
            </h1>
            <p className="text-muted-foreground">Track your path to maximum earnings</p>
          </div>
          
          {/* Highest Bonus Display */}
          <div className="text-right space-y-1">
            <p className="text-sm text-muted-foreground uppercase tracking-wide">Maximum Bonus Potential</p>
            <div className="text-4xl font-bold text-primary">
              {(() => {
                // Find the maximum bonus dollar amount across all rows
                const bonusAmounts = outputsMap.bonus_dollars.map(addr => outputs[addr] ?? 0);
                const maxBonus = Math.max(...bonusAmounts);
                return maxBonus.toLocaleString(undefined, { style: "currency", currency: "USD" });
              })()}
            </div>
            <p className="text-xs text-muted-foreground">Top tier achievement</p>
          </div>
        </div>
      </div>

      <header className="flex items-end justify-between">
        <div className="flex gap-2 items-center">
          <Button 
            variant="gradient-glow" 
            onClick={handleSave}
            disabled={!isDirty}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Data
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="hover:bg-destructive/10 hover:text-destructive">
                Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to reset?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear all your current data and restore the default values. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Reset All Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="space-y-4">
          <Card title="Baseline" subtitle="Enter your current TOTAL Items In Force for each line here.\n(this data is best found in the Item Portfolio Growth Detail + Business Metrics Printable View Dash Report)" 
            headerAction={
              <Button 
                onClick={() => navigate('/snapshot-planner')}
                disabled={!isGridValid || !isGridSaved}
                className="gap-2 bg-gradient-to-r from-red-500 to-yellow-600 text-white hover:from-red-600 hover:to-yellow-700"
              >
                <Target className="h-4 w-4" />
                Snapshot Planner
              </Button>
            }
          >
            <BaselineTable state={state} setState={setField} computedValues={allOutputs} />
          </Card>
          <Card title="New Business" subtitle="Enter your TOTAL production for each line for the prior year here.\n(this data is best found in the P&C New Business Summary Report)">
            <NewBusinessTable state={state} setState={setField} computedValues={allOutputs} />
          </Card>
          <Card title="Growth Bonus Factors">
            <GrowthBonusFactorsCard state={state} setState={setField} computedValues={allOutputs} />
          </Card>
        </section>

        <section className="space-y-4">
          <KPIStrip outputs={outputs as any} />
          {isHydrated ? (
            <Card title="Growth Grid Summary">
              <SummaryGrid state={state} computed={allOutputs} setField={setField} />
            </Card>
          ) : (
            <Card title="Growth Grid Summary">
              <div className="p-4 text-sm text-muted-foreground">Loading…</div>
            </Card>
          )}
        </section>
          </div>
        </>
      )}
    </main>
  );
}

function Card({ title, subtitle, children, headerAction }:{ title:string; subtitle?: string; children:any; headerAction?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-card-foreground">{title}</div>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function KPIStrip({ outputs }:{ outputs: Record<string, number> }) {
  const fmtMoney = (n:number)=> n.toLocaleString(undefined,{ style:"currency", currency:"USD" });
  const fmtPct = (n:number)=> `${(n*100).toFixed(2)}%`;
  const fmt2 = (n:number)=> (Number.isFinite(n)? n:0).toFixed(2);
  const h = outputs["Sheet1!H38"] ?? 0;
  const d = outputs["Sheet1!D38"] ?? 0;
  const k = outputs["Sheet1!K38"] ?? 0;
  const l = outputs["Sheet1!L38"] ?? 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KPI label="Bonus %" value={fmtPct(h)} />
      <KPI label="Bonus $" value={fmtMoney(d)} />
      <KPI label="Daily Points Needed" value={fmt2(k)} />
      <KPI label="Daily Items Needed" value={fmt2(l)} />
    </div>
  );
}
function KPI({ label, value }:{ label:string; value:string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold text-card-foreground">{value}</div>
    </div>
  );
}