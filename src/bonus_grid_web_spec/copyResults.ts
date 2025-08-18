import { formatValue } from "./format";
export type CellAddr = `${string}!${string}`;

const rows = [38,39,40,41,42,43,44] as const;
const A = (s:string)=>s as CellAddr;

export function buildCopyPayload(inputState: Record<CellAddr, any>, outputs: Record<CellAddr, number>) {
  const dashboard = rows.map(r=>({
    row: r,
    bonusPercent: outputs[A(`Sheet1!H${r}`)] ?? 0,
    bonusDollars: outputs[A(`Sheet1!D${r}`)] ?? 0,
    dailyPoints:  outputs[A(`Sheet1!K${r}`)] ?? 0,
    dailyItems:   outputs[A(`Sheet1!L${r}`)] ?? 0
  }));
  return { calculator: "allstate_bonus_grid", inputs: inputState, dashboard };
}

export function buildCopyText(inputState: Record<CellAddr, any>, outputs: Record<CellAddr, number>) {
  const lines: string[] = [];
  lines.push("Allstate Bonus Grid — Summary");
  lines.push("");
  lines.push("INPUTS");
  Object.entries(inputState).forEach(([k,v])=> lines.push(`• ${k}: ${v}`));
  lines.push("");
  lines.push("DASHBOARD (Rows 38–44)");
  for (const r of rows) {
    const bp = formatValue(A(`Sheet1!H${r}`), outputs[A(`Sheet1!H${r}`)] ?? 0);
    const bd = formatValue(A(`Sheet1!D${r}`), outputs[A(`Sheet1!D${r}`)] ?? 0);
    const dp = formatValue(A(`Sheet1!K${r}`), outputs[A(`Sheet1!K${r}`)] ?? 0);
    const di = formatValue(A(`Sheet1!L${r}`), outputs[A(`Sheet1!L${r}`)] ?? 0);
    lines.push(`• Row ${r}: Bonus % ${bp} | Bonus $ ${bd} | Daily Points ${dp} | Daily Items ${di}`);
  }
  return lines.join("\n");
}