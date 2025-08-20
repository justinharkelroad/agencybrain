// Percent normalization: UI 0–100, internal 0–1 for fields with type === "percent"
export type CellAddr = `${string}!${string}`;
type Field = { id:string; type:"number"|"percent"|"money"|"text"; sheet:string; cell:string };
type Schema = { all_fields: Field[] };

export function normalizeRate(x: string | number | undefined) {
  if (x == null || x === "") return undefined;
  const n = typeof x === "string" ? parseFloat(x.replace("%","")) : x;
  if (!isFinite(n as number)) return undefined;
  const dec = (n as number) > 1 ? (n as number)/100 : (n as number);
  return Math.max(0, Math.min(1, dec));
}

export function buildNormalizedState(rawState: Record<CellAddr, any>, schema: Schema) {
  const percentSet = new Set<string>(
    schema.all_fields.filter(f=>f.type==="percent").map(f=>`${f.sheet}!${f.cell}`)
  );
  const out: Record<CellAddr, any> = {};
  for (const [k,v] of Object.entries(rawState)) {
    if (percentSet.has(k)) {
      if (v == null || v === "") { out[k as CellAddr] = v; continue; }
      const n = typeof v === "string" ? parseFloat(v.replace("%","")) : Number(v);
      if (!Number.isFinite(n)) { out[k as CellAddr] = v; continue; }
      // If value already a decimal 0..1, keep it. If value looks like whole percent, convert.
      out[k as CellAddr] = n <= 1 ? n : (n / 100);
    } else {
      out[k as CellAddr] = v;
    }
  }
  return out;
}