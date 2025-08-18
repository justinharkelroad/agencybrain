export type CellAddr = `${string}!${string}`;

export const BASELINE_ROWS = [
  { name: "Standard Auto", row: 9, items: "Sheet1!C9" as CellAddr, ppi: "Sheet1!D9" as CellAddr, retention: "Sheet1!F9" as CellAddr, total: "Sheet1!E9" as CellAddr, loss: "Sheet1!G9" as CellAddr },
  { name: "Non-Standard Auto", row: 10, items: "Sheet1!C10" as CellAddr, ppi: "Sheet1!D10" as CellAddr, retention: "Sheet1!F10" as CellAddr, total: "Sheet1!E10" as CellAddr, loss: "Sheet1!G10" as CellAddr },
  { name: "Commercial Auto", row: 11, items: "Sheet1!C11" as CellAddr, ppi: "Sheet1!D11" as CellAddr, retention: "Sheet1!F11" as CellAddr, total: "Sheet1!E11" as CellAddr, loss: "Sheet1!G11" as CellAddr },
  { name: "Special Auto", row: 12, items: "Sheet1!C12" as CellAddr, ppi: "Sheet1!D12" as CellAddr, retention: "Sheet1!F12" as CellAddr, total: "Sheet1!E12" as CellAddr, loss: "Sheet1!G12" as CellAddr },
  { name: "Homeowners", row: 13, items: "Sheet1!C13" as CellAddr, ppi: "Sheet1!D13" as CellAddr, retention: "Sheet1!F13" as CellAddr, total: "Sheet1!E13" as CellAddr, loss: "Sheet1!G13" as CellAddr },
  { name: "Condo", row: 14, items: "Sheet1!C14" as CellAddr, ppi: "Sheet1!D14" as CellAddr, retention: "Sheet1!F14" as CellAddr, total: "Sheet1!E14" as CellAddr, loss: "Sheet1!G14" as CellAddr },
  { name: "Boat", row: 15, items: "Sheet1!C15" as CellAddr, ppi: "Sheet1!D15" as CellAddr, retention: "Sheet1!F15" as CellAddr, total: "Sheet1!E15" as CellAddr, loss: "Sheet1!G15" as CellAddr },
  { name: "Landlord", row: 16, items: "Sheet1!C16" as CellAddr, ppi: "Sheet1!D16" as CellAddr, retention: "Sheet1!F16" as CellAddr, total: "Sheet1!E16" as CellAddr, loss: "Sheet1!G16" as CellAddr },
  { name: "Manufactured Home", row: 17, items: "Sheet1!C17" as CellAddr, ppi: "Sheet1!D17" as CellAddr, retention: "Sheet1!F17" as CellAddr, total: "Sheet1!E17" as CellAddr, loss: "Sheet1!G17" as CellAddr },
  { name: "Umbrella", row: 18, items: "Sheet1!C18" as CellAddr, ppi: "Sheet1!D18" as CellAddr, retention: "Sheet1!F18" as CellAddr, total: "Sheet1!E18" as CellAddr, loss: "Sheet1!G18" as CellAddr },
  { name: "Renters", row: 19, items: "Sheet1!C19" as CellAddr, ppi: "Sheet1!D19" as CellAddr, retention: "Sheet1!F19" as CellAddr, total: "Sheet1!E19" as CellAddr, loss: "Sheet1!G19" as CellAddr },
  { name: "Commercial CPP", row: 20, items: "Sheet1!C20" as CellAddr, ppi: "Sheet1!D20" as CellAddr, retention: "Sheet1!F20" as CellAddr, total: "Sheet1!E20" as CellAddr, loss: "Sheet1!G20" as CellAddr },
  { name: "Commercial BOP", row: 21, items: "Sheet1!C21" as CellAddr, ppi: "Sheet1!D21" as CellAddr, retention: "Sheet1!F21" as CellAddr, total: "Sheet1!E21" as CellAddr, loss: "Sheet1!G21" as CellAddr },
  { name: "Motor Club", row: 22, items: "Sheet1!C22" as CellAddr, ppi: "Sheet1!D22" as CellAddr, retention: "Sheet1!F22" as CellAddr, total: "Sheet1!E22" as CellAddr, loss: "Sheet1!G22" as CellAddr },
  { name: "Life & Retirement", row: 23, items: "Sheet1!C23" as CellAddr, ppi: "Sheet1!D23" as CellAddr, retention: "Sheet1!F23" as CellAddr, total: "Sheet1!E23" as CellAddr, loss: "Sheet1!G23" as CellAddr },
] as const;

export const NEW_BIZ_ROWS = [
  { name: "Standard Auto", row: 9, items: "Sheet1!K9" as CellAddr, ppi: "Sheet1!L9" as CellAddr, total: "Sheet1!M9" as CellAddr },
  { name: "Non-Standard Auto", row: 10, items: "Sheet1!K10" as CellAddr, ppi: "Sheet1!L10" as CellAddr, total: "Sheet1!M10" as CellAddr },
  { name: "Commercial Auto", row: 11, items: "Sheet1!K11" as CellAddr, ppi: "Sheet1!L11" as CellAddr, total: "Sheet1!M11" as CellAddr },
  { name: "Special Auto", row: 12, items: "Sheet1!K12" as CellAddr, ppi: "Sheet1!L12" as CellAddr, total: "Sheet1!M12" as CellAddr },
  { name: "Homeowners", row: 13, items: "Sheet1!K13" as CellAddr, ppi: "Sheet1!L13" as CellAddr, total: "Sheet1!M13" as CellAddr },
  { name: "Condo", row: 14, items: "Sheet1!K14" as CellAddr, ppi: "Sheet1!L14" as CellAddr, total: "Sheet1!M14" as CellAddr },
  { name: "Boat", row: 15, items: "Sheet1!K15" as CellAddr, ppi: "Sheet1!L15" as CellAddr, total: "Sheet1!M15" as CellAddr },
  { name: "Landlord", row: 16, items: "Sheet1!K16" as CellAddr, ppi: "Sheet1!L16" as CellAddr, total: "Sheet1!M16" as CellAddr },
  { name: "Manufactured Home", row: 17, items: "Sheet1!K17" as CellAddr, ppi: "Sheet1!L17" as CellAddr, total: "Sheet1!M17" as CellAddr },
  { name: "Umbrella", row: 18, items: "Sheet1!K18" as CellAddr, ppi: "Sheet1!L18" as CellAddr, total: "Sheet1!M18" as CellAddr },
  { name: "Renters", row: 19, items: "Sheet1!K19" as CellAddr, ppi: "Sheet1!L19" as CellAddr, total: "Sheet1!M19" as CellAddr },
  { name: "Commercial CPP", row: 20, items: "Sheet1!K20" as CellAddr, ppi: "Sheet1!L20" as CellAddr, total: "Sheet1!M20" as CellAddr },
  { name: "Commercial BOP", row: 21, items: "Sheet1!K21" as CellAddr, ppi: "Sheet1!L21" as CellAddr, total: "Sheet1!M21" as CellAddr },
  { name: "Motor Club", row: 22, items: "Sheet1!K22" as CellAddr, ppi: "Sheet1!L22" as CellAddr, total: "Sheet1!M22" as CellAddr },
  { name: "Life & Retirement", row: 23, items: "Sheet1!K23" as CellAddr, ppi: "Sheet1!L23" as CellAddr, total: "Sheet1!M23" as CellAddr },
] as const;

export const GRID_GOAL_ROWS = [38, 39, 40, 41, 42, 43, 44] as const;