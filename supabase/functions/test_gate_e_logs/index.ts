// Test function to demonstrate Gate E logging
import { serve } from "https://deno.land/std/http/server.ts";

// Replicate the same logging structure from submit_public_form
function logStructured(level: 'info' | 'warn' | 'error', eventType: string, data: Record<string, any>) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    event_type: eventType,
    function_version: "3.2-GATE-E-OBSERVABILITY",
    deployment_id: "deploy-20250910-gatee",
    ...data
  };
  
  if (level === 'error') {
    console.error(`[${level.toUpperCase()}] ${eventType}:`, JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(`[${level.toUpperCase()}] ${eventType}:`, JSON.stringify(logEntry));
  } else {
    console.info(`[${level.toUpperCase()}] ${eventType}:`, JSON.stringify(logEntry));
  }
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = performance.now();
  
  // Simulate different log scenarios based on query param
  const url = new URL(req.url);
  const scenario = url.searchParams.get('scenario') || 'success';
  
  switch (scenario) {
    case 'success':
      // Simulate successful submission log
      logStructured('info', 'submission_success', {
        submission_id: "550e8400-e29b-41d4-a716-446655440000",
        team_member_id: "660e8400-e29b-41d4-a716-446655440001",
        agency_id: "770e8400-e29b-41d4-a716-446655440002",
        kpi_version_id: "880e8400-e29b-41d4-a716-446655440003",
        label_at_submit: "Daily Activity Report Q4 2024",
        status: "success",
        duration_ms: Math.round(performance.now() - startTime),
        request_id: requestId,
        quoted_prospects: 3,
        sold_policies: 1,
        is_late: false,
        work_date: "2025-09-10"
      });
      return new Response(JSON.stringify({error: null, result: "Success log generated"}));
      
    case 'validation_fail':
      // Simulate validation failure (400)
      logStructured('warn', 'validation_failed', {
        request_id: requestId,
        error_type: 'invalid_payload', 
        missing_fields: { teamMemberId: false, submissionDate: true }
      });
      return new Response(JSON.stringify({error: "invalid_payload"}), {status: 400});
      
    case 'auth_fail':
      // Simulate authorization failure (401) 
      logStructured('warn', 'form_disabled', {
        request_id: requestId,
        form_link_id: "aa0e8400-e29b-41d4-a716-446655440004"
      });
      return new Response(JSON.stringify({error: "unauthorized"}), {status: 401});
      
    case 'server_error':
      // Simulate internal server error (500)
      const errorId = crypto.randomUUID();
      logStructured('error', 'submission_failed', {
        request_id: requestId,
        error_id: errorId,
        status: 'error',
        duration_ms: Math.round(performance.now() - startTime),
        error_message: "Database connection failed",
        stack: "Error: Database connection failed\n    at Client.query (/path/to/file.ts:123:45)"
      });
      return new Response(JSON.stringify({error: "internal_error", id: errorId}), {status: 500});
      
    case 'timeout':
      // Simulate database timeout
      const timeoutErrorId = crypto.randomUUID();
      logStructured('error', 'database_timeout', {
        operation: 'form_links_lookup',
        timeout_ms: 5000,
        error_id: timeoutErrorId,
        request_id: requestId
      });
      return new Response(JSON.stringify({error: "internal_error", id: timeoutErrorId}), {status: 504});
      
    default:
      return new Response(JSON.stringify({
        usage: "Add ?scenario= with: success, validation_fail, auth_fail, server_error, timeout"
      }));
  }
});