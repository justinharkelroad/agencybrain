import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a Supabase client with the service role key for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Create a client with the user's token to verify they're an admin
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    })

    // Verify the requesting user is an admin
    const { data: profile, error: profileError } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', (await supabaseUser.auth.getUser()).data.user?.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admin users can create accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse the request body
    const { email, password, firstName, lastName, agencyName, agencyDescription } = await req.json()

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !agencyName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // First create or find the agency
    let agencyId: string

    const { data: existingAgency, error: agencySearchError } = await supabaseAdmin
      .from('agencies')
      .select('id')
      .eq('name', agencyName)
      .maybeSingle()

    if (agencySearchError) {
      throw agencySearchError
    }

    if (existingAgency) {
      agencyId = existingAgency.id
    } else {
      // Create new agency
      const { data: newAgency, error: createAgencyError } = await supabaseAdmin
        .from('agencies')
        .insert({
          name: agencyName,
          description: agencyDescription || null
        })
        .select('id')
        .single()

      if (createAgencyError) {
        throw createAgencyError
      }

      agencyId = newAgency.id
    }

    // Check if user already exists by email
    const { data: existingUser, error: userCheckError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (userCheckError) {
      throw userCheckError
    }

    const userExists = existingUser.users.find(user => user.email === email)
    
    if (userExists) {
      return new Response(
        JSON.stringify({ error: 'A user with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the user with admin privileges
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        agency_name: agencyName
      }
    })

    if (authError) {
      throw authError
    }

    // Create the profile using upsert to handle any edge cases
    const { error: profileCreateError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        agency_id: agencyId,
        role: 'user'
      }, {
        onConflict: 'id'
      })

    if (profileCreateError) {
      // If profile creation fails, we should clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw profileCreateError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authData.user.id,
          email: authData.user.email,
          agency_id: agencyId
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error creating user:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})