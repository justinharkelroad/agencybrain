import { supabase } from "@/integrations/supabase/client";

export async function fetchActivePromptsOnly() {
  console.log("🔍 Fetching active prompts...");
  
  // 1) Try authenticated first
  try {
    console.log("🔐 Trying authenticated fetch for prompts");
    const auth = await supa
      .from("prompts")
      .select("*")
      .eq("is_active", true)
      .order("category", { ascending: true });
    
    if (!auth.error) {
      console.log("✅ Auth prompts fetch successful:", auth.data?.length, "rows");
      return auth.data ?? [];
    }
    console.log("⚠️ Auth prompts fetch failed:", auth.error);
  } catch (authError) {
    console.log("❌ Auth prompts fetch exception:", authError);
  }

  // 2) Fallback to anonymous
  try {
    console.log("🌐 Trying anonymous fetch for prompts");
    const anon = await supaPublic
      .from("prompts")
      .select("*")
      .eq("is_active", true)
      .order("category", { ascending: true });
    
    if (!anon.error) {
      console.log("✅ Anon prompts fetch successful:", anon.data?.length, "rows");
      return anon.data ?? [];
    }
    console.log("⚠️ Anon prompts fetch failed:", anon.error);
    throw Object.assign(new Error("PROMPTS_READ_DENIED"), { status: anon.status, error: anon.error });
  } catch (anonError) {
    console.log("❌ Anon prompts fetch exception:", anonError);
    throw anonError;
  }
}

export async function fetchActiveProcessVaultTypes() {
  console.log("🔍 Fetching active process vault types...");
  
  // 1) Try authenticated first
  try {
    console.log("🔐 Trying authenticated fetch for process_vault_types");
    const auth = await supa
      .from("process_vault_types")
      .select("*")
      .eq("is_active", true)
      .order("title", { ascending: true });
    
    if (!auth.error) {
      console.log("✅ Auth PVT fetch successful:", auth.data?.length, "rows");
      return auth.data ?? [];
    }
    console.log("⚠️ Auth PVT fetch failed:", auth.error);
  } catch (authError) {
    console.log("❌ Auth PVT fetch exception:", authError);
  }

  // 2) Fallback to anonymous
  try {
    console.log("🌐 Trying anonymous fetch for process_vault_types");
    const anon = await supaPublic
      .from("process_vault_types")
      .select("*")
      .eq("is_active", true)
      .order("title", { ascending: true });
    
    if (!anon.error) {
      console.log("✅ Anon PVT fetch successful:", anon.data?.length, "rows");
      return anon.data ?? [];
    }
    console.log("⚠️ Anon PVT fetch failed:", anon.error);
    throw Object.assign(new Error("PVT_READ_DENIED"), { status: anon.status, error: anon.error });
  } catch (anonError) {
    console.log("❌ Anon PVT fetch exception:", anonError);
    throw anonError;
  }
}