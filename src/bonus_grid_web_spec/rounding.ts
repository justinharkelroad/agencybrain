import Decimal from "decimal.js";
export const D = (v: Decimal.Value) => new Decimal(v);

export function formatCurrency(v: Decimal.Value) {
  const x = D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const s = x.toFixed(2);
  const [i,f] = s.split(".");
  return `$${i.replace(/\B(?=(\d{3})+(?!\d))/g,",")}.${f}`;
}

export function roundByType(value: number, type: string, digits: number): Decimal {
  const decimal = D(value);
  
  switch (type) {
    case "integer":
      return decimal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    case "money":
      return decimal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    case "two_decimals":
      return decimal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    default:
      return decimal.toDecimalPlaces(digits, Decimal.ROUND_HALF_UP);
  }
}