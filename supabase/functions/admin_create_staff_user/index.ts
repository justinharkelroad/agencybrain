import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// PBKDF2 password hashing using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(derivedBits);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Format: pbkdf2_sha256$100000$salt$hash
  return `pbkdf2_sha256$100000$${saltHex}$${hashHex}`;
}

interface CreateTeamMemberInput {
  name: string;
  role: 'Sales' | 'Service' | 'Manager' | 'Hybrid';
  email?: string;
  employment?: 'Full-time' | 'Part-time' | 'Contract';
}

interface CreateStaffUserInput {
  agency_id: string;
  username: string;
  password: string;
  display_name?: string;
  email?: string;
  team_member_id?: string;
  create_team_member?: CreateTeamMemberInput;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, agency_id')
      .eq('id', user.id)
      .single();

    const isSuperAdmin = profile?.role === 'admin';
    const isAgencyOwner = !!profile?.agency_id;

    if (!profile || (!isSuperAdmin && !isAgencyOwner)) {
      return new Response(
        JSON.stringify({ error: 'Admin or Agency Owner access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CreateStaffUserInput = await req.json();
    const { agency_id, username, password, display_name, email, team_member_id, create_team_member } = body;

    // Agency owners can only create staff for their own agency
    if (!isSuperAdmin && agency_id !== profile.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this agency' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!agency_id || !username || !password) {
      return new Response(
        JSON.stringify({ error: 'agency_id, username, and password required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Validate password strength
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('staff_users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Username already exists' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if email is already used by any staff user (when email provided)
    if (email) {
      const { data: emailConflict } = await supabase
        .from('staff_users')
        .select('id, username, team_member_id')
        .eq('email', email)
        .maybeSingle();

      // If email exists at all during CREATE, it's always a conflict
      if (emailConflict) {
        // Same team member = they already have a staff account
        if (emailConflict.team_member_id === team_member_id) {
          return new Response(
            JSON.stringify({ 
              error: 'team_member_already_linked',
              message: `This team member already has a staff account with username "${emailConflict.username}".`,
              existing_username: emailConflict.username,
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Different team member = email already taken
        return new Response(
          JSON.stringify({ 
            error: 'email_conflict',
            message: `This email is already used by staff account "${emailConflict.username}". Update the team member's email first, or deactivate the conflicting staff account.`,
            existing_username: emailConflict.username,
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Handle team member linking/creation
    let finalTeamMemberId: string | null = null;

    if (team_member_id) {
      // Verify team member exists and belongs to same agency
      const { data: existingTm, error: tmError } = await supabase
        .from('team_members')
        .select('id, agency_id')
        .eq('id', team_member_id)
        .single();

      if (tmError || !existingTm) {
        return new Response(
          JSON.stringify({ error: 'Team member not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (existingTm.agency_id !== agency_id) {
        return new Response(
          JSON.stringify({ error: 'Team member belongs to different agency' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if team member is already linked to a staff user
      const { data: linkedStaff } = await supabase
        .from('staff_users')
        .select('id')
        .eq('team_member_id', team_member_id)
        .single();

      if (linkedStaff) {
        return new Response(
          JSON.stringify({ error: 'Team member is already linked to another staff user' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      finalTeamMemberId = team_member_id;
      console.log(`Linking to existing team member: ${team_member_id}`);
    } else if (create_team_member) {
      // Create new team member
      const { data: newTm, error: createTmError } = await supabase
        .from('team_members')
        .insert({
          agency_id,
          name: create_team_member.name,
          role: create_team_member.role,
          email: create_team_member.email || email || null,
          status: 'active',
          employment: create_team_member.employment || 'Full-time'
        })
        .select('id')
        .single();

      if (createTmError) {
        console.error('Failed to create team member:', createTmError);
        return new Response(
          JSON.stringify({ error: 'Failed to create team member' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      finalTeamMemberId = newTm.id;
      console.log(`Created new team member: ${newTm.id}`);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create staff user with optional team_member link
    const { data: staffUser, error: createError } = await supabase
      .from('staff_users')
      .insert({
        agency_id,
        username,
        password_hash: passwordHash,
        display_name: display_name || username,
        email: email || null,
        team_member_id: finalTeamMemberId,
        is_active: true
      })
      .select()
      .single();

    if (createError) {
      console.error('Failed to create staff user:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create staff user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Staff user created: ${username} for agency ${agency_id}, team_member_id: ${finalTeamMemberId || 'none'}`);

    // Return user data without password hash
    const { password_hash, ...userData } = staffUser;

    return new Response(
      JSON.stringify({ user: userData }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Admin create staff user error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
