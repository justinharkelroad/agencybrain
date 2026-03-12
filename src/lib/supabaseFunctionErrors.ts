import { FunctionsHttpError } from "@supabase/supabase-js";

export async function getSupabaseFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      if (typeof payload?.error === "string" && payload.error.trim()) {
        return payload.error;
      }
      if (typeof payload?.message === "string" && payload.message.trim()) {
        return payload.message;
      }
    } catch {
      try {
        const text = await error.context.text();
        if (text.trim()) {
          return text;
        }
      } catch {
        // Ignore parsing failures and fall back to the generic message below.
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Failed to save sale";
}
