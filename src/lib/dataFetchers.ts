import { supa } from "@/lib/supabase";

export async function fetchActivePromptsOnly() {
  const { data, error, status } = await supa
    .from("prompts")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true });

  if (error) {
    throw Object.assign(new Error("PROMPTS_READ_DENIED"), { status, error });
  }
  return data ?? [];
}

export async function fetchActiveProcessVaultTypes() {
  const { data, error, status } = await supa
    .from("process_vault_types")
    .select("*")
    .eq("is_active", true)
    .order("title", { ascending: true });

  if (error) {
    throw Object.assign(new Error("PVT_READ_DENIED"), { status, error });
  }
  return data ?? [];
}