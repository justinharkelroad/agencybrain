import outputsMap from "./outputs_addresses.json";
import { formatValue } from "./format";
export type CellAddr = `${string}!${string}`;

export function buildCopyPayload(inputState: Record<CellAddr, any>, outputs: Record<CellAddr, number>) {
  const rows = [38,39,40,41,42,43,44];
  const dashboard = rows.map(r=>({
    row: r,
    bonusPercent: outputs[`Sheet1!H${r}` as CellAddr] ?? 0,
    bonusDollars: outputs[`Sheet1!D${r}` as CellAddr] ?? 0,
    dailyPoints:  outputs[`Sheet1!K${r}` as CellAddr] ?? 0,
    dailyItems:   outputs[`Sheet1!L${r}` as CellAddr] ?? 0
  }));
  return { calculator: "allstate_bonus_grid", inputs: inputState, dashboard };
}

export function buildCopyText(inputState: Record<CellAddr, any>, outputs: Record<CellAddr, number>) {
  const rows = [38,39,40,41,42,43,44];
  const lines: string[] = [];
  lines.push("Allstate Bonus Grid — Summary");
  lines.push("");
  lines.push("INPUTS");
  for (const [k,v] of Object.entries(inputState)) lines.push(`• ${k}: ${v}`);
  lines.push("");
  lines.push("DASHBOARD");
  for (const r of rows) {
    const bp = formatValue(`Sheet1!H${r}` as CellAddr, outputs[`Sheet1!H${r}` as CellAddr] ?? 0);
    const bd = formatValue(`Sheet1!D${r}` as CellAddr, outputs[`Sheet1!D${r}` as CellAddr] ?? 0);
    const dp = formatValue(`Sheet1!K${r}` as CellAddr, outputs[`Sheet1!K${r}` as CellAddr] ?? 0);
    const di = formatValue(`Sheet1!L${r}` as CellAddr, outputs[`Sheet1!L${r}` as CellAddr] ?? 0);
    lines.push(`• Row ${r}: Bonus % ${bp} | Bonus $ ${bd} | Daily Points ${dp} | Daily Items ${di}`);
  }
  return lines.join("\n");
}