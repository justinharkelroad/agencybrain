import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import inputsSchema from "../bonus_grid_web_spec/schema_inputs.json";
import { InputsForm } from "../bonus_grid_web_spec/InputsForm";
import { SummaryGrid } from "../bonus_grid_web_spec/SummaryGrid";
import { computeRounded, type CellAddr, type WorkbookState } from "../bonus_grid_web_spec/computeWithRounding";
import outputsMap from "../bonus_grid_web_spec/outputs_addresses.json";
import { buildCopyPayload, buildCopyText } from "../bonus_grid_web_spec/copyResults";
import { buildNormalizedState } from "../bonus_grid_web_spec/normalize";
import { toast } from "@/hooks/use-toast";

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center justify-between mt-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to calculators">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-base font-medium text-muted-foreground">{title}</h3>
      </div>
    </div>
  );
}

export function BonusGridForm({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<Record<CellAddr, any>>(() => {
    // seed defaults from schema
    const s: Record<CellAddr, any> = {};
    for (const f of (inputsSchema as any).all_fields) {
      const addr = `${f.sheet}!${f.cell}` as CellAddr;
      if (f.default != null) s[addr] = f.default;
    }
    return s;
  });

  const setField = (addr: CellAddr, val: any) => setState(prev => ({ ...prev, [addr]: val }));

  const outputAddrs = useMemo(() => (
    [
      ...outputsMap.bonus_percent_preset,
      ...outputsMap.bonus_dollars,
      ...outputsMap.daily_points_needed,
      ...outputsMap.daily_items_needed,
    ] as CellAddr[]
  ), []);

  const outputs = useMemo(() => {
    const normalized = buildNormalizedState(state, inputsSchema as any);
    return computeRounded({ inputs: normalized } as WorkbookState, outputAddrs);
  }, [state]);

  const copy = async () => {
    try {
      const normalized = buildNormalizedState(state, inputsSchema as any);
      const payload = buildCopyPayload(normalized, outputs);
      const text = buildCopyText(normalized, outputs);
      const blob = new Blob([JSON.stringify(payload, null, 2) + "\n\n" + text], { type: "text/plain" });
      await navigator.clipboard.writeText(JSON.stringify(payload) + "\n\n" + text);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "bonus_grid_results.txt";
      a.click();
      toast({ title: "Results copied", description: "Bonus grid results copied to clipboard and downloaded" });
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually.", variant: "destructive" });
    }
  };

  const reset = () => {
    const s: Record<CellAddr, any> = {};
    for (const f of (inputsSchema as any).all_fields) {
      const addr = `${f.sheet}!${f.cell}` as CellAddr;
      if (f.default != null) s[addr] = f.default;
    }
    setState(s);
    toast({ title: "Reset complete", description: "All inputs have been reset to defaults" });
  };

  return (
    <div className="space-y-6">
      <BackHeader title="Allstate Bonus Grid" onBack={onBack} />
      
      <div className="space-y-4">
        <section>
          <InputsForm state={state} setState={setField} />
        </section>

        <section>
          <SummaryGrid state={state} />
        </section>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={reset}>Reset</Button>
          <Button variant="outline" onClick={copy}>Copy Results</Button>
        </div>
      </div>
    </div>
  );
}