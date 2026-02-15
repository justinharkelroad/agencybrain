/**
 * Resolves a Supabase FunctionsHttpError into a user-friendly message.
 * Used by call-scoring QA components to display meaningful errors
 * instead of raw HTTP error text.
 */
export async function resolveFunctionErrorMessage(fnError: unknown): Promise<string> {
  const maybeError = fnError as {
    message?: string;
    status?: number;
    code?: string;
    context?: {
      status?: number;
      json?: () => Promise<{ error?: string }>;
    };
  };

  const message =
    typeof maybeError?.message === 'string' ? maybeError.message : 'Unable to run QA search';

  const status = maybeError?.status ?? maybeError?.context?.status;
  let bodyMessage = message;

  if (maybeError?.context?.json) {
    try {
      const errorBody = await maybeError.context.json();
      if (errorBody?.error && typeof errorBody.error === 'string') {
        bodyMessage = errorBody.error;
      }
    } catch {
      // ignore body parse failures; fall back to status/message handling
    }
  }

  const normalized = bodyMessage.toLowerCase();

  if (status === 401 || status === 403) {
    if (normalized.includes('session') || normalized.includes('authorization') || normalized.includes('token')) {
      return 'Session expired or missing. Please re-login and try again.';
    }
    return 'Access denied for call Q&A. Verify your login and feature permissions.';
  }

  if (status === 409) {
    if (normalized.includes('timestamped') || normalized.includes('transcript segments')) {
      return 'This call needs to be reprocessed to generate timestamped segments before timeline Q&A works.';
    }
    return bodyMessage || 'Timeline Q&A cannot process this call yet.';
  }

  return bodyMessage;
}
