export type EnvStatus = "safe" | "unstable" | "unknown";

export type EnvOverride = {
  status: Exclude<EnvStatus, "unknown">;
  note?: string;
  updatedAt: string; // ISO
  userId?: string;
};

const STORAGE_KEY = "env-status-override";

export function computeEnvironmentStatusFromHealth(
  sessionOk: boolean | null,
  authOk: boolean | null,
  dbOk: boolean | null
): EnvStatus {
  if (sessionOk === true && authOk === true && dbOk === true) return "safe";
  if (sessionOk === false || authOk === false || dbOk === false) return "unstable";
  return "unknown";
}

export function getEnvironmentOverride(): EnvOverride | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.status === "safe" || parsed.status === "unstable")) {
      return parsed as EnvOverride;
    }
    return null;
  } catch {
    return null;
  }
}

export function setEnvironmentOverride(
  status: Exclude<EnvStatus, "unknown">,
  note?: string,
  userId?: string
): EnvOverride {
  const override: EnvOverride = {
    status,
    note,
    updatedAt: new Date().toISOString(),
    userId,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(override));
  return override;
}

export function clearEnvironmentOverride(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getEffectiveEnvironmentStatus(params: {
  sessionOk: boolean | null;
  authOk: boolean | null;
  dbOk: boolean | null;
}): { status: EnvStatus; source: "override" | "computed"; note?: string; updatedAt?: string } {
  const ov = getEnvironmentOverride();
  if (ov) {
    return { status: ov.status, source: "override", note: ov.note, updatedAt: ov.updatedAt };
  }
  return {
    status: computeEnvironmentStatusFromHealth(params.sessionOk, params.authOk, params.dbOk),
    source: "computed",
  };
}
