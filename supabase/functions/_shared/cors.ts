export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

export const handleOptions = (req: Request) =>
  req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;