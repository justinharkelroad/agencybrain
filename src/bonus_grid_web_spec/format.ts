import { formatCurrency } from "./rounding";
export function formatValue(addr: string, v: number): string {
  if (addr.startsWith("Sheet1!D")) return formatCurrency(v);
  return v.toString();
}