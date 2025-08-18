// formulas_impl.ts – Generated Excel-to-TS evaluator
// Supports cell references, ranges, SUM, arithmetic, and safe defaults.

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
  
  // Growth Grid rows (38-44)
  "Sheet1!D38": (ctx)=> ctx.get("Sheet1!C38")*ctx.get("Sheet1!D32"),
  "Sheet1!E38": (ctx)=> ctx.get("Sheet1!G24"),
  "Sheet1!F38": (ctx)=> ctx.get("Sheet1!E38")+ctx.get("Sheet1!B38"),
  "Sheet1!G38": (ctx)=> ctx.get("Sheet1!F38")*(1-ctx.get("Sheet1!D34")),
  "Sheet1!H38": (ctx)=> ctx.get("Sheet1!F38")+ctx.get("Sheet1!G38"),
  "Sheet1!I38": (ctx)=> ctx.get("Sheet1!H38")/12,
  "Sheet1!J38": (ctx)=> ctx.get("Sheet1!I38")/ctx.get("Sheet1!D31"),
  "Sheet1!K38": (ctx)=> ctx.get("Sheet1!I38")/21,
  "Sheet1!L38": (ctx)=> ctx.get("Sheet1!K38")/ctx.get("Sheet1!D31"),
  
  "Sheet1!D39": (ctx)=> ctx.get("Sheet1!C39")*ctx.get("Sheet1!D32"),
  "Sheet1!E39": (ctx)=> ctx.get("Sheet1!G24"),
  "Sheet1!F39": (ctx)=> ctx.get("Sheet1!E39")+ctx.get("Sheet1!B39"),
  "Sheet1!G39": (ctx)=> ctx.get("Sheet1!F39")*(1-ctx.get("Sheet1!D34")),
  "Sheet1!H39": (ctx)=> ctx.get("Sheet1!F39")+ctx.get("Sheet1!G39"),
  "Sheet1!I39": (ctx)=> ctx.get("Sheet1!H39")/12,
  "Sheet1!J39": (ctx)=> ctx.get("Sheet1!I39")/ctx.get("Sheet1!D31"),
  "Sheet1!K39": (ctx)=> ctx.get("Sheet1!I39")/21,
  "Sheet1!L39": (ctx)=> ctx.get("Sheet1!K39")/ctx.get("Sheet1!D31"),
  
  "Sheet1!D40": (ctx)=> ctx.get("Sheet1!C40")*ctx.get("Sheet1!D32"),
  "Sheet1!E40": (ctx)=> ctx.get("Sheet1!G24"),
  "Sheet1!F40": (ctx)=> ctx.get("Sheet1!E40")+ctx.get("Sheet1!B40"),
  "Sheet1!G40": (ctx)=> ctx.get("Sheet1!F40")*(1-ctx.get("Sheet1!D34")),
  "Sheet1!H40": (ctx)=> ctx.get("Sheet1!F40")+ctx.get("Sheet1!G40"),
  "Sheet1!I40": (ctx)=> ctx.get("Sheet1!H40")/12,
  "Sheet1!J40": (ctx)=> ctx.get("Sheet1!I40")/ctx.get("Sheet1!D31"),
  "Sheet1!K40": (ctx)=> ctx.get("Sheet1!I40")/21,
  "Sheet1!L40": (ctx)=> ctx.get("Sheet1!K40")/ctx.get("Sheet1!D31"),
  
  "Sheet1!D41": (ctx)=> ctx.get("Sheet1!C41")*ctx.get("Sheet1!D32"),
  "Sheet1!E41": (ctx)=> ctx.get("Sheet1!G24"),
  "Sheet1!F41": (ctx)=> ctx.get("Sheet1!E41")+ctx.get("Sheet1!B41"),
  "Sheet1!G41": (ctx)=> ctx.get("Sheet1!F41")*(1-ctx.get("Sheet1!D34")),
  "Sheet1!H41": (ctx)=> ctx.get("Sheet1!F41")+ctx.get("Sheet1!G41"),
  "Sheet1!I41": (ctx)=> ctx.get("Sheet1!H41")/12,
  "Sheet1!J41": (ctx)=> ctx.get("Sheet1!I41")/ctx.get("Sheet1!D31"),
  "Sheet1!K41": (ctx)=> ctx.get("Sheet1!I41")/21,
  "Sheet1!L41": (ctx)=> ctx.get("Sheet1!K41")/ctx.get("Sheet1!D31"),
  
  "Sheet1!D42": (ctx)=> ctx.get("Sheet1!C42")*ctx.get("Sheet1!D32"),
  "Sheet1!E42": (ctx)=> ctx.get("Sheet1!G24"),
  "Sheet1!F42": (ctx)=> ctx.get("Sheet1!E42")+ctx.get("Sheet1!B42"),
  "Sheet1!G42": (ctx)=> ctx.get("Sheet1!F42")*(1-ctx.get("Sheet1!D34")),
  "Sheet1!H42": (ctx)=> ctx.get("Sheet1!F42")+ctx.get("Sheet1!G42"),
  "Sheet1!I42": (ctx)=> ctx.get("Sheet1!H42")/12,
  "Sheet1!J42": (ctx)=> ctx.get("Sheet1!I42")/ctx.get("Sheet1!D31"),
  "Sheet1!K42": (ctx)=> ctx.get("Sheet1!I42")/21,
  "Sheet1!L42": (ctx)=> ctx.get("Sheet1!K42")/ctx.get("Sheet1!D31"),
  
  "Sheet1!D43": (ctx)=> ctx.get("Sheet1!C43")*ctx.get("Sheet1!D32"),
  "Sheet1!E43": (ctx)=> ctx.get("Sheet1!G24"),
  "Sheet1!F43": (ctx)=> ctx.get("Sheet1!E43")+ctx.get("Sheet1!B43"),
  "Sheet1!G43": (ctx)=> ctx.get("Sheet1!F43")*(1-ctx.get("Sheet1!D34")),
  "Sheet1!H43": (ctx)=> ctx.get("Sheet1!F43")+ctx.get("Sheet1!G43"),
  "Sheet1!I43": (ctx)=> ctx.get("Sheet1!H43")/12,
  "Sheet1!J43": (ctx)=> ctx.get("Sheet1!I43")/ctx.get("Sheet1!D31"),
  "Sheet1!K43": (ctx)=> ctx.get("Sheet1!I43")/21,
  "Sheet1!L43": (ctx)=> ctx.get("Sheet1!K43")/ctx.get("Sheet1!D31"),
  
  "Sheet1!D44": (ctx)=> ctx.get("Sheet1!C44")*ctx.get("Sheet1!D32"),
  "Sheet1!E44": (ctx)=> ctx.get("Sheet1!G24"),
  "Sheet1!F44": (ctx)=> ctx.get("Sheet1!E44")+ctx.get("Sheet1!B44"),
  "Sheet1!G44": (ctx)=> ctx.get("Sheet1!F44")*(1-ctx.get("Sheet1!D34")),
  "Sheet1!H44": (ctx)=> ctx.get("Sheet1!F44")+ctx.get("Sheet1!G44"),
  "Sheet1!I44": (ctx)=> ctx.get("Sheet1!H44")/12,
  "Sheet1!J44": (ctx)=> ctx.get("Sheet1!I44")/ctx.get("Sheet1!D31"),
  "Sheet1!K44": (ctx)=> ctx.get("Sheet1!I44")/21,
  "Sheet1!L44": (ctx)=> ctx.get("Sheet1!K44")/ctx.get("Sheet1!D31"),
};

export function computeSelected(state: WorkbookState, addrs: CellAddr[]): Record<CellAddr, number> {
  const r = new Resolver(state);
  const out: Record<CellAddr, number> = {};
  for (const a of addrs) out[a] = r.get(a);
  return out;
}