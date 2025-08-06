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
    const { data: userAuth } = await supabaseUser.auth.getUser()
    if (!userAuth.user?.id) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile, error: profileError } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', userAuth.user.id)
      .maybeSingle()

    if (profileError || profile?.role !== 'admin') {
      console.error('Profile error:', profileError)
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
      console.error('Agency search error:', agencySearchError)
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
        console.error('Create agency error:', createAgencyError)
        throw createAgencyError
      }

      agencyId = newAgency.id
    }

    // Check if user already exists by email (efficient approach)
    console.log('Checking if user exists with email:', email)
    try {
      const { data: existingUser, error: userCheckError } = await supabaseAdmin.auth.admin.getUserByEmail(email)
      
      if (existingUser && existingUser.user) {
        console.log('User already exists:', existingUser.user.id)
        return new Response(
          JSON.stringify({ error: 'A user with this email already exists' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (userCheckError && userCheckError.message !== 'User not found') {
        console.error('User check error:', userCheckError)
        throw userCheckError
      }
      
      console.log('User does not exist, proceeding with creation')
    } catch (error) {
      console.error('Error checking user existence:', error)
      // If it's just "user not found", that's what we want
      if (error.message !== 'User not found') {
        throw error
      }
    }

    // Create the user with admin privileges
    console.log('Creating auth user for email:', email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      raw_user_meta_data: {
        first_name: firstName,
        last_name: lastName,
        agency_name: agencyName
      }
    })

    if (authError) {
      console.error('Auth user creation error:', authError)
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
      console.error('Profile creation error:', profileCreateError)
      // If profile creation fails, we should clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw profileCreateError
    }

    console.log('Successfully created user:', authData.user.id)

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