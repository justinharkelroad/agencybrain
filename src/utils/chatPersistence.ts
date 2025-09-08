
import { supabase } from "@/integrations/supabase/client";

export type ChatMessageRow = {
  id: string;
  analysis_id: string;
  user_id: string | null;
  role: "user" | "assistant";
  content: string;
  shared_with_client: boolean;
  created_at: string;
};

export async function fetchChatMessages(analysisId: string) {
  console.log("[chatPersistence] fetchChatMessages", { analysisId });
  const { data, error } = await supa
    .from("ai_chat_messages")
    .select("*")
    .eq("analysis_id", analysisId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as ChatMessageRow[];
}

export async function insertChatMessage(analysisId: string, role: "user" | "assistant", content: string) {
  console.log("[chatPersistence] insertChatMessage", { analysisId, role, preview: content.slice(0, 80) });
  const { data, error } = await supa
    .from("ai_chat_messages")
    .insert([{ analysis_id: analysisId, role, content }])
    .select()
    .single();

  if (error) throw error;
  return data as ChatMessageRow;
}

export async function clearChatMessages(analysisId: string) {
  console.log("[chatPersistence] clearChatMessages", { analysisId });
  const { error } = await supa
    .from("ai_chat_messages")
    .delete()
    .eq("analysis_id", analysisId);

  if (error) throw error;
  return true;
}

export async function markMessageShared(messageId: string, shared: boolean = true) {
  console.log("[chatPersistence] markMessageShared", { messageId, shared });
  const { data, error } = await supa
    .from("ai_chat_messages")
    .update({ shared_with_client: shared })
    .eq("id", messageId)
    .select()
    .single();

  if (error) throw error;
  return data as ChatMessageRow;
}
