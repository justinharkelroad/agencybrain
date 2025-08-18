import Decimal from "decimal.js";
export const D = (v: Decimal.Value) => new Decimal(v);
export function formatCurrency(v: Decimal.Value) {
  const x = D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const s = x.toFixed(2);
  const [i,f] = s.split(".");
  return `$${i.replace(/\B(?=(\d{3})+(?!\d))/g,",")}.${f}`;
}