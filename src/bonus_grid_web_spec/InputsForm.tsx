import schema from "./schema_inputs.json";
type Field = { id:string; label:string; type:"number"|"percent"|"money"|"text"; sheet:string; cell:string; default?: any; sectionId?: string };
type CellAddr = `${string}!${string}`;

export function InputsForm({ state, setState, sectionId }:{
  state: Record<CellAddr, any>;
  setState: (addr: CellAddr, val: any)=>void;
  sectionId?: "baseline" | "new_business" | "growth_bonus_factors" | "growth_grid";
}) {
  const all = (schema as any).all_fields as Field[];
  const fields = sectionId ? all.filter(f => (f as any).sectionId === sectionId) : all;

  return (
    <div className="grid grid-cols-1 gap-3">
      {pair(fields).map((row, idx)=>(
        <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {row.map(f=>{
            const addr = `${f.sheet}!${f.cell}` as CellAddr;
            const val = state[addr] ?? f.default ?? "";
            return (
              <div key={f.id} className="grid gap-1">
                <label className="text-xs text-muted-foreground">{f.label}</label>
                <input
                  className="border border-input rounded-lg px-3 py-2 bg-background text-foreground placeholder-muted-foreground focus:border-ring"
                  inputMode="decimal"
                  value={val}
                  onChange={e=>setState(addr, e.target.value)}
                  placeholder={f.type==="percent" ? "0–100" : ""}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
function pair<T>(arr:T[]): T[][] { const out:T[][]=[]; for(let i=0;i<arr.length;i+=2) out.push(arr.slice(i,i+2)); return out; }