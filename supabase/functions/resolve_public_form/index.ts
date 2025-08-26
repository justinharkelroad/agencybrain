import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const securityHeaders = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff", 
  "referrer-policy": "no-referrer",
  "permissions-policy": "interest-cohort=()",
  "vary": "host"
};

// Rate limiting store (in-memory for simplicity)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 60; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in ms

function checkRateLimit(ip: string, tokenPrefix: string): boolean {
  const key = `${ip}:${tokenPrefix}`;
  const now = Date.now();
  
  // Clean expired entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetTime < now) {
      rateLimitStore.delete(k);
    }
  }
  
  const current = rateLimitStore.get(key);
  if (!current) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (current.resetTime < now) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (current.count >= RATE_LIMIT) {
    return false;
  }
  
  current.count++;
  return true;
}

function getAgencySlugFromHost(req: Request): string | null {
  // Trust X-Forwarded-Host from proxy, fallback to Host header
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  
  // Canonicalize www. to agency slug
  const cleanHost = host.replace(/^www\./, '');
  
  // Extract agency slug (first part before domain)
  const parts = cleanHost.split('.');
  if (parts.length >= 3 && parts[1] === 'myagencybrain') {
    return parts[0];
  }
  
  return null;
}

function logSecure(level: string, message: string, data?: Record<string, any>) {
  const sanitizedData = data ? {
    ...data,
    token: data.token ? `${data.token.substring(0, 6)}***` : undefined,
    tokenPrefix: data.token ? data.token.substring(0, 6) : undefined
  } : {};
  
  console.log(`[${level}] ${message}`, sanitizedData);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { ...corsHeaders, ...securityHeaders } });
  }

  try {
    // Parse URL path and query parameters
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Expected format: /resolve_public_form?agencySlug=...&formSlug=...&t=...
    const agencySlug = url.searchParams.get("agencySlug");
    const formSlug = url.searchParams.get("formSlug"); 
    const token = url.searchParams.get("t");
    
    // Validate required parameters
    if (!agencySlug || !formSlug || !token) {
      logSecure('WARN', 'Missing required parameters', { agencySlug, formSlug, hasToken: !!token });
      return new Response(
        JSON.stringify({ code: "BAD_REQUEST" }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, ...securityHeaders }
        }
      );
    }

    // Extract client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // Check rate limit
    const tokenPrefix = token.substring(0, 6);
    if (!checkRateLimit(clientIP, tokenPrefix)) {
      logSecure('WARN', 'Rate limit exceeded', { clientIP, tokenPrefix });
      return new Response(
        JSON.stringify({ code: "RATE_LIMITED" }), 
        { 
          status: 429, 
          headers: { ...corsHeaders, ...securityHeaders }
        }
      );
    }

    // No host validation needed for path-based routing
    logSecure('DEBUG', 'Processing path-based form request', { 
      agencySlug, 
      formSlug, 
      tokenPrefix 
    });

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Step 1: Get form link by token
    const { data: formLink, error: linkError } = await supabase
      .from("form_links")
      .select("id, enabled, token, expires_at, form_template_id")
      .eq("token", token)
      .eq("enabled", true)
      .single();

    if (linkError || !formLink) {
      logSecure('INFO', 'Form link not found or disabled', { 
        tokenPrefix, 
        error: linkError?.message 
      });
      return new Response(
        JSON.stringify({ code: "NOT_FOUND" }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, ...securityHeaders }
        }
      );
    }

    // Step 2: Get form template by ID and slug
    const { data: formTemplate, error: templateError } = await supabase
      .from("form_templates")
      .select("id, slug, status, name, schema_json, settings_json, agency_id")
      .eq("id", formLink.form_template_id)
      .eq("slug", formSlug)
      .single();

    if (templateError || !formTemplate) {
      logSecure('INFO', 'Form template not found or slug mismatch', { 
        formSlug, 
        tokenPrefix, 
        error: templateError?.message 
      });
      return new Response(
        JSON.stringify({ code: "NOT_FOUND" }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, ...securityHeaders }
        }
      );
    }

    // Step 3: Get agency by ID and slug  
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("id, slug, name")
      .eq("id", formTemplate.agency_id)
      .eq("slug", agencySlug)
      .single();

    if (agencyError || !agency) {
      logSecure('INFO', 'Agency not found or slug mismatch', { 
        agencySlug, 
        tokenPrefix, 
        error: agencyError?.message 
      });
      return new Response(
        JSON.stringify({ code: "NOT_FOUND" }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, ...securityHeaders }
        }
      );
    }

    // Combine data for validation
    const data = {
      id: formLink.id,
      enabled: formLink.enabled,
      token: formLink.token,
      expires_at: formLink.expires_at,
      form_template: {
        ...formTemplate,
        agency: agency
      }
    };

    // Check expiry
    const now = new Date();
    if (data.expires_at && new Date(data.expires_at) < now) {
      logSecure('INFO', 'Form link expired', { 
        formSlug, 
        agencySlug, 
        tokenPrefix, 
        expiresAt: data.expires_at 
      });
      return new Response(
        JSON.stringify({ code: "EXPIRED" }), 
        { 
          status: 410, 
          headers: { ...corsHeaders, ...securityHeaders }
        }
      );
    }

    // Check form status
    if (data.form_template.status !== "published") {
      logSecure('INFO', 'Form not published', { 
        formSlug, 
        agencySlug, 
        tokenPrefix, 
        status: data.form_template.status 
      });
      return new Response(
        JSON.stringify({ code: "NOT_FOUND" }), // Return NOT_FOUND for unpublished forms externally
        { 
          status: 404, 
          headers: { ...corsHeaders, ...securityHeaders }
        }
      );
    }

    // Success - return form data
    logSecure('INFO', 'Form resolved successfully', { 
      formSlug, 
      agencySlug, 
      tokenPrefix,
      formId: data.form_template.id
    });

    return new Response(
      JSON.stringify({
        form: {
          id: data.form_template.id,
          name: data.form_template.name,
          slug: data.form_template.slug,
          schema: data.form_template.schema_json,
          settings: data.form_template.settings_json,
          agency: {
            id: data.form_template.agency.id,
            name: data.form_template.agency.name,
            slug: data.form_template.agency.slug
          }
        }
      }),
      { 
        headers: { 
          ...corsHeaders, 
          ...securityHeaders,
          "cache-control": "private, max-age=300" // 5 min cache for success
        }
      }
    );

  } catch (error) {
    logSecure('ERROR', 'Server error in resolve_public_form', { 
      error: error.message, 
      stack: error.stack 
    });
    return new Response(
      JSON.stringify({ code: "SERVER_ERROR" }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, ...securityHeaders }
      }
    );
  }
});