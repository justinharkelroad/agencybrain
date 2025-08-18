import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useBlocker } from "react-router-dom";
import { ArrowLeft, Save, Clock } from "lucide-react";
import inputsSchema from "../bonus_grid_web_spec/schema_inputs.json";
import { SummaryGrid } from "../bonus_grid_web_spec/SummaryGrid";
import { computeRounded, type CellAddr, type WorkbookState } from "../bonus_grid_web_spec/computeWithRounding";
import outputsMap from "../bonus_grid_web_spec/outputs_addresses.json";
import { buildCopyPayload, buildCopyText } from "../bonus_grid_web_spec/copyResults";
import { buildNormalizedState } from "../bonus_grid_web_spec/normalize";
import { BaselineTable } from "../bonus_grid_web_spec/BaselineTable";
import { NewBusinessTable } from "../bonus_grid_web_spec/NewBusinessTable";
import { GrowthBonusFactorsCard } from "../bonus_grid_web_spec/GrowthBonusFactorsCard";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

import { BASELINE_ROWS, NEW_BIZ_ROWS } from "../bonus_grid_web_spec/rows";

const STORAGE_KEY = "bonusGrid:inputs";
const PPI_DEFAULTS: Record<CellAddr, number> = {
  "Sheet1!D9":10,"Sheet1!D10":0,"Sheet1!D11":0,"Sheet1!D12":5,"Sheet1!D13":20,"Sheet1!D14":20,
  "Sheet1!D15":5,"Sheet1!D16":5,"Sheet1!D17":5,"Sheet1!D18":5,"Sheet1!D19":5,"Sheet1!D20":0,
  "Sheet1!D21":0,"Sheet1!D22":0,"Sheet1!D23":10,
  "Sheet1!L9":10,"Sheet1!L10":0,"Sheet1!L11":0,"Sheet1!L12":5,"Sheet1!L13":20,"Sheet1!L14":20,
  "Sheet1!L15":5,"Sheet1!L16":5,"Sheet1!L17":5,"Sheet1!L18":5,"Sheet1!L19":5,"Sheet1!L20":0,
  "Sheet1!L21":0,"Sheet1!L22":0,"Sheet1!L23":10,
};

function hydrate(): Record<CellAddr, any> {
  let saved: Record<string, any> = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch {}
  // schema defaults
  const withSchema = Object.fromEntries(
    (inputsSchema as any).all_fields.map((f: any) => [`${f.sheet}!${f.cell}` as CellAddr, f.default ?? ""])
  );
  // backfill PPI if missing/empty
  for (const [k,v] of Object.entries(PPI_DEFAULTS)) {
    if (saved[k] === undefined || saved[k] === null || saved[k] === "") saved[k] = v;
  }
  return { ...withSchema, ...saved };
}

export default function BonusGridPage(){
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showNavigationDialog, setShowNavigationDialog] = useState(false);
  const [nextLocation, setNextLocation] = useState<string | null>(null);
  
  const [state, setState] = useState<Record<CellAddr, any>>(() => hydrate());
  
  const setField = (addr: CellAddr, val: any) => {
    setState(p=>({ ...p, [addr]: val }));
    setHasUnsavedChanges(true);
  };

  // Auto-save with visual feedback
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    
    setIsAutoSaving(true);
    const id = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setIsAutoSaving(false);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    }, 500);
    return () => clearTimeout(id);
  }, [state, hasUnsavedChanges]);

  // Block navigation when there are unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );

  // Handle browser beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle blocked navigation
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setNextLocation(blocker.location.pathname);
      setShowNavigationDialog(true);
    }
  }, [blocker]);

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
    const baseline = BASELINE_ROWS.flatMap(r => [r.total, r.loss]); // no r.ppi
    const newBiz = NEW_BIZ_ROWS.map(r => r.total);                  // M9–M23
    const gbf: CellAddr[] = ["Sheet1!D30","Sheet1!D31","Sheet1!D32"]; // exclude D29
    return [...outputAddrs, ...baseline, ...newBiz, ...gbf];
  }, [outputAddrs]);

  const outputs = useMemo(()=>{
    const normalized = buildNormalizedState(state, inputsSchema as any);
    return computeRounded({ inputs: normalized } as WorkbookState, outputAddrs);
  }, [state]);

  const allOutputs = useMemo(()=>{
    const normalized = buildNormalizedState(state, inputsSchema as any);
    return computeRounded({ inputs: normalized } as WorkbookState, allComputedAddrs);
  }, [state, allComputedAddrs]);

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

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setLastSaved(new Date());
    setHasUnsavedChanges(false);
    toast({
      title: "Data saved!",
      description: "Your bonus grid data has been saved successfully.",
    });
  };
  
  const handleReset = () => { 
    setState({}); 
    localStorage.removeItem(STORAGE_KEY); 
    setHasUnsavedChanges(false);
    setLastSaved(new Date());
  };

  const handleSaveAndNavigate = useCallback(() => {
    handleSave();
    setShowNavigationDialog(false);
    if (nextLocation) {
      navigate(nextLocation);
    }
  }, [nextLocation, navigate]);

  const handleNavigateWithoutSaving = useCallback(() => {
    setHasUnsavedChanges(false);
    setShowNavigationDialog(false);
    if (nextLocation) {
      navigate(nextLocation);
    }
  }, [nextLocation, navigate]);

  const handleStay = useCallback(() => {
    setShowNavigationDialog(false);
    setNextLocation(null);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Return to Dashboard
            </Button>
          </Link>
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
        
        {/* Save Status */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isAutoSaving ? (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 animate-spin" />
              Saving...
            </div>
          ) : hasUnsavedChanges ? (
            <div className="flex items-center gap-2 text-amber-600">
              <Clock className="h-4 w-4" />
              Unsaved changes
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <Save className="h-4 w-4" />
              Saved at {lastSaved.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Allstate Bonus Grid</h1>
          <p className="text-sm text-muted-foreground">Inputs on the left. Results on the right.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button 
            variant="outline" 
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Data
          </Button>
          <Button 
            variant="outline" 
            onClick={copy}
          >
            Copy Results
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

      {/* Navigation Dialog */}
      <AlertDialog open={showNavigationDialog} onOpenChange={setShowNavigationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes that will be lost if you leave this page. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStay}>Stay on Page</AlertDialogCancel>
            <Button variant="outline" onClick={handleNavigateWithoutSaving}>
              Leave Without Saving
            </Button>
            <AlertDialogAction onClick={handleSaveAndNavigate}>
              Save & Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="space-y-4">
          <Card title="Baseline">
            <BaselineTable state={state} setState={setField} computedValues={allOutputs} />
          </Card>
          <Card title="New Business">
            <NewBusinessTable state={state} setState={setField} computedValues={allOutputs} />
          </Card>
          <Card title="Growth Bonus Factors">
            <GrowthBonusFactorsCard state={state} setState={setField} computedValues={allOutputs} />
          </Card>
        </section>

        <section className="space-y-4">
          <KPIStrip outputs={outputs as any} />
          <Card title="Growth Grid Summary"><SummaryGrid state={state} setState={setField} /></Card>
        </section>
      </div>
    </main>
  );
}

function Card({ title, children }:{ title:string; children:any }) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border text-sm font-medium text-card-foreground">{title}</div>
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
      <KPI label="Daily Points" value={fmt2(k)} />
      <KPI label="Daily Items" value={fmt2(l)} />
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