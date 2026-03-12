import type { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { extractSupabaseFunctionErrorMessage } from "@/lib/supabaseFunctionErrors";

type FunctionInvokeError = FunctionsHttpError | FunctionsRelayError | FunctionsFetchError | Error | null;

function isExpiredJwtMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("invalid or expired jwt") || normalized.includes("jwt expired");
}

export async function invokeSupabaseFunctionWithSessionRefresh<TResponse>(
  functionName: string,
  options: Parameters<typeof supabase.functions.invoke>[1],
): Promise<{ data: TResponse | null; error: FunctionInvokeError }> {
  const firstAttempt = await supabase.functions.invoke<TResponse>(functionName, options);
  if (!firstAttempt.error) return firstAttempt;

  const firstMessage = await extractSupabaseFunctionErrorMessage(firstAttempt.error);
  if (!isExpiredJwtMessage(firstMessage)) return firstAttempt;

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshData.session) {
    return firstAttempt;
  }

  return await supabase.functions.invoke<TResponse>(functionName, options);
}
