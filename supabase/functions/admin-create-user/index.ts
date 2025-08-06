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

    // Check if user already exists by email using database query
    console.log('Checking if user exists with email:', email)
    const { data: existingUserProfile, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', 'EXISTS(SELECT 1 FROM auth.users WHERE email = \'' + email + '\')')
      .maybeSingle()

    // Alternative approach: check via a more direct method
    let userExists = false
    try {
      // Try to get user session with the email to check existence
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1
      })
      
      if (!listError && users?.users) {
        // Since we can't efficiently filter by email in listUsers, 
        // we'll proceed with creation and let the auth system handle duplicates
        console.log('Proceeding with user creation - duplicate check will be handled by auth system')
      }
    } catch (error) {
      console.log('Could not check user existence, proceeding with creation:', error)
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
      
      // Handle specific auth errors
      if (authError.message?.includes('already registered')) {
        return new Response(
          JSON.stringify({ error: 'A user with this email already exists' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw authError
    }

    console.log('Auth user created successfully:', authData.user.id)

    // Create the profile using upsert to handle any edge cases
    console.log('Creating user profile for user:', authData.user.id)
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
      console.log('Cleaning up auth user due to profile creation failure')
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        console.log('Auth user cleanup successful')
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError)
      }
      throw profileCreateError
    }

    console.log('Profile created successfully for user:', authData.user.id)

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