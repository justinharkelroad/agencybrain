import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyRequest, isVerifyError } from '../_shared/verifyRequest.ts';

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

interface SetupTeamInput {
  purchase_id: string;
  team_members: TeamMember[];
  self_participating: boolean;
  start_date: string;
  timezone?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth (supports both JWT and staff session)
    const authResult = await verifyRequest(req);
    if (isVerifyError(authResult)) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { agencyId } = authResult;
    const input: SetupTeamInput = await req.json();
    const { purchase_id, team_members, self_participating, start_date } = input;

    console.log('[challenge-setup-team] Starting team setup:', {
      agencyId,
      purchase_id,
      memberCount: team_members.length,
      selfParticipating: self_participating,
    });

    if (!purchase_id || !team_members) {
      return new Response(
        JSON.stringify({ error: 'purchase_id and team_members are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (team_members.length === 0 && !self_participating) {
      return new Response(
        JSON.stringify({ error: 'Add at least one team member or include yourself' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify purchase belongs to this agency and has available seats
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('challenge_purchases')
      .select('id, agency_id, quantity, seats_used, challenge_product_id, purchaser_id')
      .eq('id', purchase_id)
      .single();

    if (purchaseError || !purchase) {
      return new Response(
        JSON.stringify({ error: 'Purchase not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (purchase.agency_id !== agencyId) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Owner self-participation is free — only staff members use seats
    const totalSeatsNeeded = team_members.length;
    const availableSeats = purchase.quantity - (purchase.seats_used || 0);

    if (totalSeatsNeeded > availableSeats) {
      return new Response(
        JSON.stringify({
          error: `Not enough seats. Need ${totalSeatsNeeded} but only ${availableSeats} available.`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const timezone = input.timezone || 'America/New_York';
    const createdCredentials: Array<{ name: string; username: string; password: string }> = [];

    // 2. If self_participating: create a staff_user for the owner (or reuse existing) and assign
    if (self_participating) {
      // Check if a staff user already exists for this owner
      const { data: existingStaffUser } = await supabaseAdmin
        .from('staff_users')
        .select('id, display_name, username, team_member_id')
        .eq('agency_id', agencyId)
        .eq('linked_profile_id', purchase.purchaser_id)
        .maybeSingle();

      let ownerStaffId: string | null = null;
      let ownerTeamMemberId: string | null = null;
      let ownerCredential: { name: string; username: string; password: string } | null = null;

      if (existingStaffUser) {
        // Reuse existing staff user — no new credentials needed
        ownerStaffId = existingStaffUser.id;
        ownerTeamMemberId = existingStaffUser.team_member_id;
        console.log('[challenge-setup-team] Reusing existing staff user for owner:', ownerStaffId);
      } else {
        // Create new staff user for owner
        const { data: ownerProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', purchase.purchaser_id)
          .maybeSingle();

        const { data: ownerUser } = await supabaseAdmin.auth.admin.getUserById(purchase.purchaser_id);
        const ownerEmail = ownerUser?.user?.email || '';
        const ownerName = ownerProfile?.full_name || ownerEmail.split('@')[0];

        const staffPassword = generatePassword();
        const passwordHash = await hashPassword(staffPassword);
        const staffUsername = ownerEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '_owner';

        // Create team member row
        const { data: tm } = await supabaseAdmin
          .from('team_members')
          .insert({
            agency_id: agencyId,
            name: ownerName,
            email: ownerEmail,
            role: 'Owner',
            status: 'active',
            employment: 'Full-time',
          })
          .select()
          .single();

        if (tm) {
          const { data: staffUser, error: staffErr } = await supabaseAdmin
            .from('staff_users')
            .insert({
              agency_id: agencyId,
              username: staffUsername,
              password_hash: passwordHash,
              display_name: ownerName,
              email: ownerEmail,
              team_member_id: tm.id,
              linked_profile_id: purchase.purchaser_id,
              is_active: true,
            })
            .select()
            .single();

          if (staffUser) {
            ownerStaffId = staffUser.id;
            ownerTeamMemberId = tm.id;
            ownerCredential = {
              name: `${ownerName} (You)`,
              username: staffUsername,
              password: staffPassword,
            };
          } else if (staffErr) {
            console.error('[challenge-setup-team] Owner staff user creation error:', staffErr);
          }
        }
      }

      // Create assignment for owner (whether staff user was new or existing)
      if (ownerStaffId) {
        // Check if already assigned to this purchase (idempotent)
        const { data: existingAssignment } = await supabaseAdmin
          .from('challenge_assignments')
          .select('id')
          .eq('purchase_id', purchase.id)
          .eq('staff_user_id', ownerStaffId)
          .maybeSingle();

        if (!existingAssignment) {
          const { error: ownerAssignErr } = await supabaseAdmin.from('challenge_assignments').insert({
            agency_id: agencyId,
            staff_user_id: ownerStaffId,
            team_member_id: ownerTeamMemberId,
            challenge_product_id: purchase.challenge_product_id,
            purchase_id: purchase.id,
            assigned_by: purchase.purchaser_id,
            start_date: start_date,
            timezone,
            status: 'active',
          });

          if (ownerAssignErr) {
            console.error('[challenge-setup-team] Owner assignment insert error:', JSON.stringify(ownerAssignErr));
          } else {
            // Trigger auto-incremented seats_used — undo it because owner is free
            await supabaseAdmin
              .from('challenge_purchases')
              .update({ seats_used: Math.max(0, (purchase.seats_used || 0)) })
              .eq('id', purchase.id);
          }
        }

        if (ownerCredential) {
          createdCredentials.push(ownerCredential);
        }
      }
    }

    // 3. Create staff users for each team member
    for (const member of team_members) {
      const staffPassword = generatePassword();
      const passwordHash = await hashPassword(staffPassword);
      const baseUsername = (member.name || 'member')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 20);
      const staffUsername = `${baseUsername}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      // Create team member
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
        console.error('[challenge-setup-team] Team member creation error:', tmError);
        continue;
      }

      // Create staff user
      const { data: staffUser, error: staffError } = await supabaseAdmin
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
        console.error('[challenge-setup-team] Staff user creation error:', staffError);
        // Try with a fallback username
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

          if (altError) continue;

          await supabaseAdmin.from('challenge_assignments').insert({
            agency_id: agencyId,
            staff_user_id: altStaff.id,
            team_member_id: tm.id,
            challenge_product_id: purchase.challenge_product_id,
            purchase_id: purchase.id,
            assigned_by: purchase.purchaser_id,
            start_date: start_date,
            timezone,
            status: 'active',
          });

          createdCredentials.push({
            name: member.name,
            username: altUsername,
            password: staffPassword,
          });
          continue;
        }
        continue;
      }

      // Create challenge assignment (end_date is GENERATED ALWAYS — omit it)
      const { error: assignError } = await supabaseAdmin.from('challenge_assignments').insert({
        agency_id: agencyId,
        staff_user_id: staffUser.id,
        team_member_id: tm.id,
        challenge_product_id: purchase.challenge_product_id,
        purchase_id: purchase.id,
        assigned_by: purchase.purchaser_id,
        start_date: start_date,
        timezone,
        status: 'active',
      });

      if (assignError) {
        console.error('[challenge-setup-team] Assignment insert error:', JSON.stringify(assignError));
      } else {
        console.log('[challenge-setup-team] Assignment created for staff:', staffUser.id);
      }

      createdCredentials.push({
        name: member.name,
        username: staffUsername,
        password: staffPassword,
      });
    }

    // 4. seats_used is auto-incremented by trigger_update_challenge_purchase_seats on assignment insert
    // Re-fetch the purchase to get the trigger-updated seats_used
    const { data: updatedPurchase } = await supabaseAdmin
      .from('challenge_purchases')
      .select('seats_used')
      .eq('id', purchase.id)
      .single();
    const newSeatsUsed = updatedPurchase?.seats_used ?? (purchase.seats_used || 0);

    // 5. Send credential emails as backup
    if (createdCredentials.length > 0) {
      try {
        const { data: agencyData } = await supabaseAdmin
          .from('agencies')
          .select('name')
          .eq('id', agencyId)
          .single();

        const ownerUser = await supabaseAdmin.auth.admin.getUserById(purchase.purchaser_id);
        await fetch(
          `${supabaseUrl}/functions/v1/challenge-send-credentials`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              email: ownerUser?.data?.user?.email || '',
              staff_credentials: createdCredentials,
              agency_name: agencyData?.name || 'Your Agency',
              start_date: start_date,
            }),
          }
        );
      } catch (emailError) {
        console.error('[challenge-setup-team] Email send error:', emailError);
      }
    }

    console.log('[challenge-setup-team] Team setup complete:', {
      created: createdCredentials.length,
      seatsUsed: newSeatsUsed,
    });

    return new Response(
      JSON.stringify({
        success: true,
        credentials: createdCredentials,
        seats_used: newSeatsUsed,
        seats_remaining: purchase.quantity - newSeatsUsed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[challenge-setup-team] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
