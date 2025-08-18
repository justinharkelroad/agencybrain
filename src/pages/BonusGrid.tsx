import { useMemo, useState } from "react";
import inputsSchema from "../bonus_grid_web_spec/schema_inputs.json";
import { InputsForm } from "../bonus_grid_web_spec/InputsForm";
import { SummaryGrid } from "../bonus_grid_web_spec/SummaryGrid";
import { computeRounded, type CellAddr, type WorkbookState } from "../bonus_grid_web_spec/computeWithRounding";
import outputsMap from "../bonus_grid_web_spec/outputs_addresses.json";
import { buildCopyPayload, buildCopyText } from "../bonus_grid_web_spec/copyResults";
import { buildNormalizedState } from "../bonus_grid_web_spec/normalize";

export default function BonusGridPage(){
  const [state, setState] = useState<Record<CellAddr, any>>(()=>{
    const s: Record<CellAddr, any> = {};
    for (const f of (inputsSchema as any).all_fields) {
      const addr = `${f.sheet}!${f.cell}` as CellAddr;
      if (f.default != null) s[addr] = f.default;
    }
    return s;
  });
  const setField = (addr: CellAddr, val: any) => setState(p=>({ ...p, [addr]: val }));

  const outputAddrs = useMemo(()=>(
    [
      ...outputsMap.bonus_percent_preset,
      ...outputsMap.bonus_dollars,
      ...outputsMap.daily_points_needed,
      ...outputsMap.daily_items_needed,
    ] as CellAddr[]
  ), []);

  const outputs = useMemo(()=>{
    const normalized = buildNormalizedState(state, inputsSchema as any);
    return computeRounded({ inputs: normalized } as WorkbookState, outputAddrs);
  }, [state]);

  const copy = () => {
    const normalized = buildNormalizedState(state, inputsSchema as any);
    const payload = buildCopyPayload(normalized, outputs);
    const text = buildCopyText(normalized, outputs);
    navigator.clipboard.writeText(JSON.stringify(payload) + "\n\n" + text);
  };
  const reset = () => {
    const s: Record<CellAddr, any> = {};
    for (const f of (inputsSchema as any).all_fields) {
      const addr = `${f.sheet}!${f.cell}` as CellAddr;
      if (f.default != null) s[addr] = f.default;
    }
    setState(s);
  };

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Allstate Bonus Grid</h1>
          <p className="text-sm text-muted-foreground">Inputs on the left. Results on the right.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded-lg border border-border bg-background/50 hover:bg-background/80" onClick={copy}>Copy Results</button>
          <button className="px-3 py-2 rounded-lg border border-border" onClick={reset}>Reset</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="space-y-4">
          <Card title="Baseline"><InputsForm state={state} setState={setField} sectionId="baseline" /></Card>
          <Card title="New Business"><InputsForm state={state} setState={setField} sectionId="new_business" /></Card>
          <Card title="Growth Bonus Factors"><InputsForm state={state} setState={setField} sectionId="growth_bonus_factors" /></Card>
          <Card title="Growth Grid Goals"><InputsForm state={state} setState={setField} sectionId="growth_grid" /></Card>
        </section>

        <section className="space-y-4">
          <KPIStrip outputs={outputs as any} />
          <Card title="Growth Grid Summary"><SummaryGrid state={state} /></Card>
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