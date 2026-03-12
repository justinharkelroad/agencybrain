export function isCrossSaleLeadSource(name: string | null | undefined): boolean {
  const normalized = (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return normalized === "cross sale";
}
