import schema from "./schema_inputs.json";
type Field = { id:string; label:string; type:"number"|"percent"|"money"|"text"; sheet:string; cell:string; default?: any };
type CellAddr = `${string}!${string}`;

export function InputsForm({ state, setState }:{
  state: Record<CellAddr, any>;
  setState: (addr: CellAddr, val: any)=>void;
}) {
  const fields = (schema as any).all_fields as Field[];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map(f=>{
        const addr = `${f.sheet}!${f.cell}` as CellAddr;
        const val = state[addr] ?? f.default ?? "";
        return (
          <div key={f.id} className="grid gap-1">
            <label className="text-sm text-white/90">{f.label}</label>
            <input
              className="border border-white/10 rounded-lg p-2 bg-white/5 text-white placeholder-white/40 focus:border-white/30"
              inputMode="decimal"
              value={val}
              onChange={e=>setState(addr, e.target.value)}
              placeholder={f.type==="percent" ? "0–100" : ""}
            />
          </div>
        );
      })}
    </div>
  );
}