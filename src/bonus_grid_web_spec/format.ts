import Decimal from "decimal.js";
type CellAddr = `${string}!${string}`;
type Policy = Record<string,{type:"money"|"percent"|"integer"|"two_decimals"|"one_decimal";digits:number}>;
import policyJson from "./rounding_policy.json";
const policy = policyJson as Policy;

const safe = (n: any) => (typeof n === "number" && Number.isFinite(n)) ? n : 0;
const comma = (s: string) => {
  const [i,f=""] = s.split(".");
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f ? `.${f}` : "");
};

export function formatValue(addr: CellAddr, vIn: number): string {
  const v = safe(vIn);
  const p = policy[addr as string];
  const d = new Decimal(v);
  if (!p) return comma(d.toString());
  switch (p.type) {
    case "money":   return `$${comma(d.toDecimalPlaces(2).toFixed(2))}`;
    case "percent": { 
      const pct = d.toNumber() * 100; 
      const k = p.digits ?? 2; 
      return `${pct.toLocaleString(undefined,{minimumFractionDigits:k,maximumFractionDigits:k})}%`; 
    }
    case "integer": return comma(d.toDecimalPlaces(0).toFixed(0));
    case "two_decimals": return comma(d.toDecimalPlaces(2).toFixed(2));
    case "one_decimal":  return comma(d.toDecimalPlaces(1).toFixed(1));
    default: return comma(d.toString());
  }
}