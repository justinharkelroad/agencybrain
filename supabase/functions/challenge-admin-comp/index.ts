import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Generate a random 12-character password
function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    password += chars.charAt(randomIndex);
  }
  return password;
}

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

  return `pbkdf2_sha256$100000$${saltHex}$${hashHex}`;
}

interface TeamMember {
  name: string;
  email?: string;
}

interface CompInput {
  owner_email: string;
  owner_name: string;
  agency_name?: string;
  agency_id?: string;
  quantity: number;
  start_date: string;
  timezone?: string;
  team_members?: TeamMember[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify JWT and check admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: caller } } = await userClient.auth.getUser(jwt);
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: isAdmin, error: roleCheckError } = await userClient
      .rpc('has_role', { _user_id: caller.id, _role: 'admin' });

    if (roleCheckError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse input
    const input: CompInput = await req.json();
    const {
      owner_email,
      owner_name,
      agency_name,
      agency_id: existingAgencyId,
      quantity = 1,
      start_date,
      timezone = 'America/New_York',
      team_members = [],
    } = input;

    console.log('[challenge-admin-comp] Starting comp setup:', {
      owner_email, owner_name, agency_name, existingAgencyId, quantity, start_date,
      teamMemberCount: team_members.length,
    });

    if (!owner_email || !owner_name) {
      return new Response(
        JSON.stringify({ error: 'owner_email and owner_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!existingAgencyId && !agency_name) {
      return new Response(
        JSON.stringify({ error: 'agency_name is required when not using an existing agency' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!start_date) {
      return new Response(
        JSON.stringify({ error: 'start_date is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Check email doesn't already exist
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', owner_email)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: 'An account with this email already exists.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Track what we created for rollback
    let createdAgencyId: string | null = null;
    let createdUserId: string | null = null;

    try {
      // 4. Create or verify agency
      let agencyId: string;

      if (existingAgencyId) {
        const { data: existingAgency, error: agencyCheckError } = await supabaseAdmin
          .from('agencies')
          .select('id, name')
          .eq('id', existingAgencyId)
          .single();

        if (agencyCheckError || !existingAgency) {
          return new Response(
            JSON.stringify({ error: 'Agency not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        agencyId = existingAgency.id;
        console.log('[challenge-admin-comp] Using existing agency:', agencyId);
      } else {
        const { data: newAgency, error: agencyError } = await supabaseAdmin
          .from('agencies')
          .insert({
            name: agency_name,
            description: 'Created via admin comp access',
          })
          .select()
          .single();

        if (agencyError || !newAgency) {
          console.error('[challenge-admin-comp] Agency creation error:', agencyError);
          return new Response(
            JSON.stringify({ error: 'Failed to create agency' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        agencyId = newAgency.id;
        createdAgencyId = newAgency.id;
        console.log('[challenge-admin-comp] Agency created:', agencyId);
      }

      // 5. Create auth user with temp password
      const ownerPassword = generatePassword();
      const nameParts = owner_name.trim().split(/\s+/);
      const firstName = nameParts[0] || owner_name;
      const lastName = nameParts.slice(1).join(' ') || '';

      const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: owner_email,
        password: ownerPassword,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        }
      });

      if (userError) {
        console.error('[challenge-admin-comp] User creation error:', userError);
        if (createdAgencyId) {
          await supabaseAdmin.from('agencies').delete().eq('id', createdAgencyId);
        }
        const isDuplicate = userError.message?.toLowerCase().includes('already') ||
                           userError.message?.toLowerCase().includes('duplicate') ||
                           userError.message?.toLowerCase().includes('registered');
        return new Response(
          JSON.stringify({ error: isDuplicate ? 'An account with this email already exists.' : 'Failed to create user account' }),
          { status: isDuplicate ? 409 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      createdUserId = newUser.user.id;
      console.log('[challenge-admin-comp] Auth user created:', createdUserId);

      // 6. Update profile with agency link and Six Week Challenge tier
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          agency_id: agencyId,
          membership_tier: 'Six Week Challenge',
        })
        .eq('id', newUser.user.id);

      if (profileError) {
        console.error('[challenge-admin-comp] Profile update error:', profileError);
        throw new Error('Failed to update profile');
      }

      // 7. Generate recovery link for owner to set their own password
      const siteUrl = Deno.env.get('SITE_URL') || 'https://myagencybrain.com';
      let ownerSetupUrl = '';
      try {
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: owner_email,
          options: {
            redirectTo: `${siteUrl}/reset-password`,
          }
        });

        if (linkError) {
          console.error('[challenge-admin-comp] Recovery link error:', linkError);
        } else if (linkData?.properties?.action_link) {
          ownerSetupUrl = linkData.properties.action_link;
          console.log('[challenge-admin-comp] Recovery link generated');
        }
      } catch (linkErr) {
        console.error('[challenge-admin-comp] Recovery link error:', linkErr);
      }

      // 8. Get active challenge product
      const { data: product, error: productError } = await supabaseAdmin
        .from('challenge_products')
        .select('id')
        .eq('is_active', true)
        .single();

      if (productError || !product) {
        console.error('[challenge-admin-comp] Product fetch error:', productError);
        throw new Error('Challenge product not found');
      }

      // 9. Create challenge_purchases record — $0 comp
      const { data: purchase, error: purchaseError } = await supabaseAdmin
        .from('challenge_purchases')
        .insert({
          agency_id: agencyId,
          challenge_product_id: product.id,
          purchaser_id: newUser.user.id,
          quantity,
          seats_used: 0,
          price_per_seat_cents: 0,
          total_price_cents: 0,
          status: 'completed',
          purchased_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (purchaseError) {
        console.error('[challenge-admin-comp] Purchase creation error:', purchaseError);
        throw new Error('Failed to create purchase record');
      }

      console.log('[challenge-admin-comp] Purchase created:', purchase.id);

      // 10. Create team members + staff users + challenge assignments
      const createdCredentials: Array<{ name: string; username: string; password: string }> = [];

      for (const member of team_members) {
        const staffPassword = generatePassword();
        const passwordHash = await hashPassword(staffPassword);
        const baseUsername = (member.name || 'member')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 20);
        const staffUsername = `${baseUsername}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

        // Create team member row
        const { data: tm, error: tmError } = await supabaseAdmin
          .from('team_members')
          .insert({
            agency_id: agencyId,
            name: member.name,
            email: member.email || null,
            role: 'Sales',
            status: 'active',
            employment: 'Full-time',
          })
          .select()
          .single();

        if (tmError) {
          console.error('[challenge-admin-comp] Team member creation error:', tmError);
          continue;
        }

        // Create staff user with PBKDF2 hashed password
        let finalUsername = staffUsername;
        let staffUser = null;
        const { data: su, error: staffError } = await supabaseAdmin
          .from('staff_users')
          .insert({
            agency_id: agencyId,
            username: staffUsername,
            password_hash: passwordHash,
            display_name: member.name,
            email: member.email || null,
            team_member_id: tm.id,
            is_active: true,
          })
          .select()
          .single();

        if (staffError) {
          // Username collision — retry with timestamp-based suffix
          if (staffError.code === '23505') {
            const altUsername = `${baseUsername}${Date.now().toString(36).slice(-6)}`;
            const { data: altStaff, error: altError } = await supabaseAdmin
              .from('staff_users')
              .insert({
                agency_id: agencyId,
                username: altUsername,
                password_hash: passwordHash,
                display_name: member.name,
                email: member.email || null,
                team_member_id: tm.id,
                is_active: true,
              })
              .select()
              .single();

            if (altError) {
              console.error('[challenge-admin-comp] Staff user retry error:', altError);
              continue;
            }
            staffUser = altStaff;
            finalUsername = altUsername;
          } else {
            console.error('[challenge-admin-comp] Staff user creation error:', staffError);
            continue;
          }
        } else {
          staffUser = su;
        }

        // Create challenge assignment — status: 'active' so lessons unlock immediately
        // Do NOT include end_date — it's GENERATED ALWAYS
        const { error: assignError } = await supabaseAdmin
          .from('challenge_assignments')
          .insert({
            agency_id: agencyId,
            staff_user_id: staffUser.id,
            challenge_product_id: product.id,
            purchase_id: purchase.id,
            assigned_by: newUser.user.id,
            start_date: start_date,
            timezone,
            status: 'active',
          });

        if (assignError) {
          console.error('[challenge-admin-comp] Assignment creation error:', assignError);
          continue;
        }

        createdCredentials.push({
          name: member.name,
          username: finalUsername,
          password: staffPassword,
        });
      }

      console.log('[challenge-admin-comp] Comp setup complete:', {
        agencyId,
        userId: newUser.user.id,
        purchaseId: purchase.id,
        credentialsCreated: createdCredentials.length,
      });

      return new Response(
        JSON.stringify({
          success: true,
          agency_id: agencyId,
          user_id: newUser.user.id,
          purchase_id: purchase.id,
          owner_setup_url: ownerSetupUrl,
          start_date,
          quantity,
          credentials: createdCredentials,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (innerError) {
      // Rollback: delete auth user and agency (if newly created)
      console.error('[challenge-admin-comp] Rolling back due to error:', innerError);
      if (createdUserId) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      }
      if (createdAgencyId) {
        await supabaseAdmin.from('agencies').delete().eq('id', createdAgencyId);
      }
      return new Response(
        JSON.stringify({ error: innerError instanceof Error ? innerError.message : 'Setup failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[challenge-admin-comp] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
