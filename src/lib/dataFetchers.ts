import { supa } from "@/lib/supabase";
import { supaPublic } from "@/lib/supabasePublic";

export async function fetchActivePromptsOnly() {
  // 1) authenticated
  const auth = await supa
    .from("prompts")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true });
  
  if (!auth.error) return auth.data ?? [];

  // 2) anonymous fallback
  const anon = await supaPublic
    .from("prompts")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true });
  
  if (anon.error) {
    throw Object.assign(new Error("PROMPTS_READ_DENIED"), { status: anon.status, error: anon.error });
  }
  return anon.data ?? [];
}

export async function fetchActiveProcessVaultTypes() {
  // 1) authenticated
  const auth = await supa
    .from("process_vault_types")
    .select("*")
    .eq("is_active", true)
    .order("title", { ascending: true });
  
  if (!auth.error) return auth.data ?? [];

  // 2) anonymous fallback
  const anon = await supaPublic
    .from("process_vault_types")
    .select("*")
    .eq("is_active", true)
    .order("title", { ascending: true });
  
  if (anon.error) {
    throw Object.assign(new Error("PVT_READ_DENIED"), { status: anon.status, error: anon.error });
  }
  return anon.data ?? [];
}