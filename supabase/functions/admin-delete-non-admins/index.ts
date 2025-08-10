import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Admin client (service role)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // User client (to verify admin role)
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    })

    // Verify the requesting user
    const { data: userAuth } = await supabaseUser.auth.getUser()
    const userId = userAuth.user?.id
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify admin role
    const { data: profile, error: profileError } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || profile?.role !== 'admin') {
      console.error('Profile error or not admin:', profileError)
      return new Response(
        JSON.stringify({ error: 'Only admin users can perform this action' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse body for optional whitelist
    const body = await req.json().catch(() => ({})) as { keepEmails?: string[] }
    const keepEmails = new Set((body.keepEmails && Array.isArray(body.keepEmails) ? body.keepEmails : ['justin@hfiagencies.com']).map(e => e.toLowerCase()))

    console.log('Starting purge of non-admin users. Keep list:', Array.from(keepEmails))

    // Collect all users via pagination
    const perPage = 1000
    let page = 1
    let collected: Array<{ id: string; email?: string | null }> = []

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (error) throw error
      const users = data?.users || []
      collected = collected.concat(users.map(u => ({ id: u.id, email: u.email })))
      console.log(`Fetched page ${page}, users: ${users.length}`)
      if (users.length < perPage) break
      page += 1
    }

    // Filter users to delete
    const toDelete = collected.filter(u => {
      const email = (u.email || '').toLowerCase()
      return email && !keepEmails.has(email)
    })

    console.log(`Users to delete: ${toDelete.length}`)

    let deletedCount = 0
    const failures: Array<{ id: string; email?: string | null; error: string }> = []

    // Optional: try to delete lingering profiles first (in case SQL missed any)
    for (const u of toDelete) {
      try {
        await supabaseAdmin.from('profiles').delete().eq('id', u.id)
      } catch (e) {
        console.warn('Profile delete warning (non-fatal) for', u.email, e)
      }
    }

    // Delete auth users
    for (const u of toDelete) {
      try {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(u.id)
        if (error) throw error
        deletedCount += 1
      } catch (e: any) {
        console.error('Failed to delete user', u.email, e)
        failures.push({ id: u.id, email: u.email, error: e?.message || String(e) })
      }
    }

    console.log(`Purge complete. Deleted ${deletedCount}, failures ${failures.length}`)

    return new Response(
      JSON.stringify({ success: true, deletedCount, failures }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error purging users:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
