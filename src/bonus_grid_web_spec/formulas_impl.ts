// formulas_impl.ts – Generated Excel-to-TS evaluator
// Supports cell references, ranges, SUM, arithmetic, and safe defaults.
import bonusPerc from "./bonus_percent_presets.json";

export type CellAddr = `${string}!${string}`;
export interface WorkbookState { inputs: Record<CellAddr, number | string | null>; }
export interface CalcContext { get(addr: CellAddr): number; }

export class Resolver implements CalcContext {
  private cache = new Map<string, number>();
  constructor(private state: WorkbookState) {}
  get(addr: CellAddr): number {
    if (this.cache.has(addr)) return this.cache.get(addr)!;
    const inp = this.state.inputs[addr];
    if (typeof inp === "number") { this.cache.set(addr, inp); return inp; }
    if (typeof inp === "string") {
      const n = Number(inp.replace(/[%,$]/g, ""));
      if (!Number.isNaN(n)) { this.cache.set(addr, n); return n; }
    }
    const fn = formulaImpls[addr];
    const out = fn ? fn(this) : 0;
    this.cache.set(addr, out);
    return out;
  }
}

// Excel helpers
export const XL = {
  SUM: (...vals: number[]) => vals.reduce((a,b)=>a+(b||0), 0),
};

// Range resolver (single sheet only)
function R(sheet: string, a: string, b: string, ctx: CalcContext): number[] {
  function colToNum(col: string) {
    let num=0; for (const ch of col) num=num*26+(ch.charCodeAt(0)-64); return num;
  }
  const m1 = a.match(/^([A-Z]+)(\d+)$/)!;
  const m2 = b.match(/^([A-Z]+)(\d+)$/)!;
  const c1=colToNum(m1[1]), r1=parseInt(m1[2]);
  const c2=colToNum(m2[1]), r2=parseInt(m2[2]);
  const out: number[] = [];
  for (let rr=Math.min(r1,r2); rr<=Math.max(r1,r2); rr++) {
    for (let cc=Math.min(c1,c2); cc<=Math.max(c1,c2); cc++) {
      let col=""; let n=cc;
      while(n>0){const rem=(n-1)%26;col=String.fromCharCode(65+rem)+col;n=Math.floor((n-1)/26);}
      out.push(ctx.get(`${sheet}!${col}${rr}` as CellAddr));
    }
  }
  return out;
}

export type FormulaImpl = (ctx: CalcContext) => number;

// Formula implementations (Baseline + New Business + Grid totals)
export const formulaImpls: Record<CellAddr, FormulaImpl> = {
  // Baseline calculations (rows 9-23)
  "Sheet1!E9": (ctx)=> ctx.get("Sheet1!C9")*ctx.get("Sheet1!D9"),
  "Sheet1!G9": (ctx)=> (1-ctx.get("Sheet1!F9"))*ctx.get("Sheet1!E9"),
  "Sheet1!E10": (ctx)=> ctx.get("Sheet1!C10")*ctx.get("Sheet1!D10"),
  "Sheet1!G10": (ctx)=> (1-ctx.get("Sheet1!F10"))*ctx.get("Sheet1!E10"),
  "Sheet1!E11": (ctx)=> ctx.get("Sheet1!C11")*ctx.get("Sheet1!D11"),
  "Sheet1!G11": (ctx)=> (1-ctx.get("Sheet1!F11"))*ctx.get("Sheet1!E11"),
  "Sheet1!E12": (ctx)=> ctx.get("Sheet1!C12")*ctx.get("Sheet1!D12"),
  "Sheet1!G12": (ctx)=> (1-ctx.get("Sheet1!F12"))*ctx.get("Sheet1!E12"),
  "Sheet1!E13": (ctx)=> ctx.get("Sheet1!C13")*ctx.get("Sheet1!D13"),
  "Sheet1!G13": (ctx)=> (1-ctx.get("Sheet1!F13"))*ctx.get("Sheet1!E13"),
  "Sheet1!E14": (ctx)=> ctx.get("Sheet1!C14")*ctx.get("Sheet1!D14"),
  "Sheet1!G14": (ctx)=> (1-ctx.get("Sheet1!F14"))*ctx.get("Sheet1!E14"),
  "Sheet1!E15": (ctx)=> ctx.get("Sheet1!C15")*ctx.get("Sheet1!D15"),
  "Sheet1!G15": (ctx)=> (1-ctx.get("Sheet1!F15"))*ctx.get("Sheet1!E15"),
  "Sheet1!E16": (ctx)=> ctx.get("Sheet1!C16")*ctx.get("Sheet1!D16"),
  "Sheet1!G16": (ctx)=> (1-ctx.get("Sheet1!F16"))*ctx.get("Sheet1!E16"),
  "Sheet1!E17": (ctx)=> ctx.get("Sheet1!C17")*ctx.get("Sheet1!D17"),
  "Sheet1!G17": (ctx)=> (1-ctx.get("Sheet1!F17"))*ctx.get("Sheet1!E17"),
  "Sheet1!E18": (ctx)=> ctx.get("Sheet1!C18")*ctx.get("Sheet1!D18"),
  "Sheet1!G18": (ctx)=> (1-ctx.get("Sheet1!F18"))*ctx.get("Sheet1!E18"),
  "Sheet1!E19": (ctx)=> ctx.get("Sheet1!C19")*ctx.get("Sheet1!D19"),
  "Sheet1!G19": (ctx)=> (1-ctx.get("Sheet1!F19"))*ctx.get("Sheet1!E19"),
  "Sheet1!E20": (ctx)=> ctx.get("Sheet1!C20")*ctx.get("Sheet1!D20"),
  "Sheet1!G20": (ctx)=> (1-ctx.get("Sheet1!F20"))*ctx.get("Sheet1!E20"),
  "Sheet1!E21": (ctx)=> ctx.get("Sheet1!C21")*ctx.get("Sheet1!D21"),
  "Sheet1!G21": (ctx)=> (1-ctx.get("Sheet1!F21"))*ctx.get("Sheet1!E21"),
  "Sheet1!E22": (ctx)=> ctx.get("Sheet1!C22")*ctx.get("Sheet1!D22"),
  "Sheet1!G22": (ctx)=> (1-ctx.get("Sheet1!F22"))*ctx.get("Sheet1!E22"),
  "Sheet1!E23": (ctx)=> ctx.get("Sheet1!C23")*ctx.get("Sheet1!D23"),
  "Sheet1!G23": (ctx)=> (1-ctx.get("Sheet1!F23"))*ctx.get("Sheet1!E23"),
  
  // Baseline totals (rows 24-25)
  "Sheet1!C24": (ctx)=> XL.SUM(...R("Sheet1","C9","C23",ctx)),
  "Sheet1!E24": (ctx)=> XL.SUM(...R("Sheet1","E9","E23",ctx)),
  "Sheet1!G24": (ctx)=> XL.SUM(...R("Sheet1","G9","G23",ctx)),
  "Sheet1!E25": (ctx)=> ctx.get("Sheet1!E24")/ctx.get("Sheet1!C24"),
  
  // New Business calculations (rows 9-23)
  "Sheet1!M9": (ctx)=> ctx.get("Sheet1!K9")*ctx.get("Sheet1!L9"),
  "Sheet1!M10": (ctx)=> ctx.get("Sheet1!K10")*ctx.get("Sheet1!L10"),
  "Sheet1!M11": (ctx)=> ctx.get("Sheet1!K11")*ctx.get("Sheet1!L11"),
  "Sheet1!M12": (ctx)=> ctx.get("Sheet1!K12")*ctx.get("Sheet1!L12"),
  "Sheet1!M13": (ctx)=> ctx.get("Sheet1!K13")*ctx.get("Sheet1!L13"),
  "Sheet1!M14": (ctx)=> ctx.get("Sheet1!K14")*ctx.get("Sheet1!L14"),
  "Sheet1!M15": (ctx)=> ctx.get("Sheet1!K15")*ctx.get("Sheet1!L15"),
  "Sheet1!M16": (ctx)=> ctx.get("Sheet1!K16")*ctx.get("Sheet1!L16"),
  "Sheet1!M17": (ctx)=> ctx.get("Sheet1!K17")*ctx.get("Sheet1!L17"),
  "Sheet1!M18": (ctx)=> ctx.get("Sheet1!K18")*ctx.get("Sheet1!L18"),
  "Sheet1!M19": (ctx)=> ctx.get("Sheet1!K19")*ctx.get("Sheet1!L19"),
  "Sheet1!M20": (ctx)=> ctx.get("Sheet1!K20")*ctx.get("Sheet1!L20"),
  "Sheet1!M21": (ctx)=> ctx.get("Sheet1!K21")*ctx.get("Sheet1!L21"),
  "Sheet1!M22": (ctx)=> ctx.get("Sheet1!K22")*ctx.get("Sheet1!L22"),
  "Sheet1!M23": (ctx)=> ctx.get("Sheet1!K23")*ctx.get("Sheet1!L23"),
  
  // New Business totals
  "Sheet1!K24": (ctx)=> XL.SUM(...R("Sheet1","K9","K23",ctx)),
  "Sheet1!M24": (ctx)=> XL.SUM(...R("Sheet1","M9","M23",ctx)),
  "Sheet1!M25": (ctx)=> {
    const k24 = ctx.get("Sheet1!K24");
    return k24 > 0 ? ctx.get("Sheet1!M24") / k24 : 0;
  },
  
  // lock H38..H44 as read-only presets
  ...Object.fromEntries([38,39,40,41,42,43,44].map(r => [
    `Sheet1!H${r}` as CellAddr, 
    () => {
      const raw = (bonusPerc as any)[`H${r}`];
      const val = Number(raw);
      if (!Number.isFinite(val)) {
        throw new Error(`Missing or invalid bonus preset H${r}`);
      }
      return val;
    }
  ])),

  // Growth Grid formulas (rows 38-44) with correct address mapping
  ...Object.fromEntries([38,39,40,41,42,43,44].flatMap(r => [
    // D[r] = D33 * H[r] // Bonus $
    [`Sheet1!D${r}` as CellAddr, (ctx: CalcContext) =>
      ctx.get("Sheet1!D33" as CellAddr) * ctx.get(`Sheet1!H${r}` as CellAddr)],

    // E[r] = C[r] + G24 // Net Points Needed = Growth Goal + Point Loss Retention
    [`Sheet1!E${r}` as CellAddr, (ctx: CalcContext) => 
      ctx.get(`Sheet1!C${r}` as CellAddr) + ctx.get("Sheet1!G24" as CellAddr)],

    // F[r] = E[r] * (1 - D34) // 1st Yr Retention Loss = Net Points × (1 - Retention Rate)
    [`Sheet1!F${r}` as CellAddr, (ctx: CalcContext) =>
      ctx.get(`Sheet1!E${r}` as CellAddr) * (1 - ctx.get("Sheet1!D34" as CellAddr))],

    // G[r] = C[r] + G24 + F[r] // TOTAL Points = Growth Goal + Point Loss + Retention Loss
    [`Sheet1!G${r}` as CellAddr, (ctx: CalcContext) =>
      ctx.get(`Sheet1!C${r}` as CellAddr) + ctx.get("Sheet1!G24" as CellAddr) + ctx.get(`Sheet1!F${r}` as CellAddr)],

    // I[r] = G[r] / 12 // Monthly Points Needed
    [`Sheet1!I${r}` as CellAddr, (ctx: CalcContext) =>
      ctx.get(`Sheet1!G${r}` as CellAddr) / 12],

    // J[r] = M25 > 0 ? I[r] / M25 : 0 // Monthly Items Needed
    [`Sheet1!J${r}` as CellAddr, (ctx: CalcContext) => {
      const mix = ctx.get("Sheet1!M25" as CellAddr);
      return mix > 0 ? ctx.get(`Sheet1!I${r}` as CellAddr) / mix : 0;
    }],

    // K[r] = I[r] / 21 // Daily Points Needed
    [`Sheet1!K${r}` as CellAddr, (ctx: CalcContext) =>
      ctx.get(`Sheet1!I${r}` as CellAddr) / 21],

    // L[r] = M25 > 0 ? K[r] / M25 : 0 // Daily Items Needed
    [`Sheet1!L${r}` as CellAddr, (ctx: CalcContext) => {
      const mix = ctx.get("Sheet1!M25" as CellAddr);
      return mix > 0 ? ctx.get(`Sheet1!K${r}` as CellAddr) / mix : 0;
    }],
  ])),

  // pass-throughs
  "Sheet1!D31": (ctx) => ctx.get("Sheet1!E24" as CellAddr),
  "Sheet1!D32": (ctx) => ctx.get("Sheet1!M25" as CellAddr),

  // === Phase 7: Growth Bonus Factors ===
  // Overall Retention = SUM(F_r * E_r) / E24
  "Sheet1!D29": (ctx) => {
    const ROWS_9_23 = Array.from({ length: 15 }, (_, i) => 9 + i);
    let num = 0;
    for (const r of ROWS_9_23) {
      const Fr = ctx.get(`Sheet1!F${r}` as CellAddr); // decimal 0..1
      const Er = ctx.get(`Sheet1!E${r}` as CellAddr); // points
      num += Fr * Er;
    }
    const denom = ctx.get("Sheet1!E24" as CellAddr);
    return denom > 0 ? num / denom : 0;
  },

  // Pass-throughs so UI can bind GBF directly if desired:
  "Sheet1!D30": (ctx) => ctx.get("Sheet1!C24" as CellAddr), // Baseline Items

  // Totals for SummaryGrid
  "Sheet1!K45": (ctx) => {
    const rows = [38,39,40,41,42,43,44];
    return rows.reduce((s,r)=> s + ctx.get(`Sheet1!K${r}` as CellAddr), 0);
  },
  "Sheet1!L45": (ctx) => {
    const rows = [38,39,40,41,42,43,44];
    return rows.reduce((s,r)=> s + ctx.get(`Sheet1!L${r}` as CellAddr), 0);
  },
};

export function computeSelected(state: WorkbookState, addrs: CellAddr[]): Record<CellAddr, number> {
  const r = new Resolver(state);
  const out: Record<CellAddr, number> = {};
  for (const a of addrs) out[a] = r.get(a);
  return out;
}