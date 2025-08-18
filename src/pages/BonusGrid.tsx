import { useMemo, useState } from "react";
import inputsSchema from "../bonus_grid_web_spec/schema_inputs.json";
import { InputsForm } from "../bonus_grid_web_spec/InputsForm";
import { SummaryGrid } from "../bonus_grid_web_spec/SummaryGrid";
import { computeRounded, type CellAddr, type WorkbookState } from "../bonus_grid_web_spec/computeWithRounding";
import outputsMap from "../bonus_grid_web_spec/outputs_addresses.json";
import { buildCopyPayload, buildCopyText } from "../bonus_grid_web_spec/copyResults";
import { buildNormalizedState } from "../bonus_grid_web_spec/normalize";

export default function BonusGridPage(){
  const [state, setState] = useState<Record<CellAddr, any>>(()=> {
    // seed defaults from schema
    const s: Record<CellAddr, any> = {};
    for (const f of (inputsSchema as any).all_fields) {
      const addr = `${f.sheet}!${f.cell}` as CellAddr;
      if (f.default != null) s[addr] = f.default;
    }
    return s;
  });

  const setField = (addr: CellAddr, val: any) => setState(prev => ({ ...prev, [addr]: val }));

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
    const blob = new Blob([JSON.stringify(payload, null, 2) + "\n\n" + text], { type: "text/plain" });
    navigator.clipboard.writeText(JSON.stringify(payload) + "\n\n" + text);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bonus_grid_results.txt";
    a.click();
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
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Allstate Bonus Grid</h1>
        <p className="text-sm text-gray-600">Enter your baseline and production to see bonus, daily points, and items.</p>
      </header>

      <section className="space-y-3">
        <div className="flex gap-2">
          <button className="px-3 py-2 border rounded-lg" onClick={copy}>Copy Results</button>
          <button className="px-3 py-2 border rounded-lg" onClick={reset}>Reset</button>
        </div>
      </section>

      <section>
        <InputsForm state={state} setState={setField} />
      </section>

      <section>
        <SummaryGrid state={state} />
      </section>
    </main>
  );
}