import { supa } from "@/lib/supabase";

export async function fetchActivePrompts() {
  const { data, error } = await supa
    .from("prompts")
    .select("id,title,content,category")
    .eq("is_active", true)
    .order("title", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveProcessVaultTypes() {
  const { data, error } = await supa
    .from("process_vault_types")
    .select("id,title,is_active")
    .eq("is_active", true)
    .order("title", { ascending: true });
  if (error) throw error;
  return data ?? [];
}