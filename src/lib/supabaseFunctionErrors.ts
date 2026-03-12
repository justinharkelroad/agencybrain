import { FunctionsHttpError } from "@supabase/supabase-js";

export async function extractSupabaseFunctionErrorMessage(error: unknown): Promise<string> {
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

function isExpiredSessionMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid or expired jwt") ||
    normalized.includes("jwt expired") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("auth session missing") ||
    normalized.includes("session expired")
  );
}

function toFriendlySupabaseFunctionErrorMessage(message: string): string {
  if (isExpiredSessionMessage(message)) {
    return "Your sign-in session expired while saving. Refresh the page and try again. If it still fails, sign out and sign back in.";
  }

  return message;
}

export async function getSupabaseFunctionErrorMessage(error: unknown): Promise<string> {
  const rawMessage = await extractSupabaseFunctionErrorMessage(error);
  return toFriendlySupabaseFunctionErrorMessage(rawMessage);
}
