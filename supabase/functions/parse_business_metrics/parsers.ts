export function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function parseInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : null;
  }
  const text = String(value).trim();
  if (!text || text === "--" || text.toUpperCase() === "N/A") return null;
  const isNegative = text.includes("(") && text.includes(")");
  const normalized = text
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(isNegative ? -n : n);
}

export function parseMoneyCents(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  }
  const text = String(value).trim();
  if (!text || text === "--" || text.toUpperCase() === "N/A") return null;
  const isNegative = text.includes("(") && text.includes(")");
  const normalized = text
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .trim();
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round((isNegative ? -n : n) * 100);
}

export function parsePercentDecimal(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value > 1 || value < -1 ? value / 100 : value;
  }
  const text = String(value).trim();
  if (!text || text === "--" || text.toUpperCase() === "N/A") return null;
  const isNegative = text.includes("(") && text.includes(")");
  const hasPct = text.includes("%");
  const normalized = text
    .replace(/%/g, "")
    .replace(/,/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .trim();
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  const signed = isNegative ? -n : n;
  if (hasPct) return signed / 100;
  return signed > 1 || signed < -1 ? signed / 100 : signed;
}

export function safeAddress(column: string, row: number | undefined): string | null {
  if (!column || !row) return null;
  return `${column}${row}`;
}

export function parseAgent(raw: string | null): { agentCode: string | null; agentName: string | null } {
  if (!raw) return { agentCode: null, agentName: null };
  const match = raw.match(/^\s*(\d+)\s*-\s*(.+)\s*$/);
  if (!match) return { agentCode: null, agentName: raw };
  return {
    agentCode: match[1] ?? null,
    agentName: match[2]?.trim() ?? null,
  };
}
