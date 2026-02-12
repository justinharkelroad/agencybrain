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

// Calculate end date (6 weeks from start, ending on Friday)
function getChallengeEndDate(startDate: Date): Date {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 32); // 6 weeks * 5 days + buffer
  return endDate;
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

    if (!purchase_id || !team_members || team_members.length === 0) {
      return new Response(
        JSON.stringify({ error: 'purchase_id and team_members are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify purchase belongs to this agency and has available seats
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('challenge_purchases')
      .select('id, agency_id, quantity, seats_used, product_id, purchased_by')
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

    const totalNeeded = team_members.length + (self_participating ? 1 : 0);
    const availableSeats = purchase.quantity - (purchase.seats_used || 0);

    if (totalNeeded > availableSeats) {
      return new Response(
        JSON.stringify({
          error: `Not enough seats. Need ${totalNeeded} but only ${availableSeats} available.`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startDateObj = new Date(start_date);
    const endDate = getChallengeEndDate(startDateObj);
    const createdCredentials: Array<{ name: string; username: string; password: string }> = [];

    // 2. If self_participating: create a staff_user for the owner linked to their profile
    if (self_participating) {
      // Check if a staff user already exists for this owner
      const { data: existingStaffUser } = await supabaseAdmin
        .from('staff_users')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('linked_profile_id', purchase.purchased_by)
        .maybeSingle();

      if (!existingStaffUser) {
        // Get owner info
        const { data: ownerProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', purchase.purchased_by)
          .maybeSingle();

        const { data: ownerUser } = await supabaseAdmin.auth.admin.getUserById(purchase.purchased_by);
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
          // Create staff user linked to owner profile
          const { data: staffUser, error: staffErr } = await supabaseAdmin
            .from('staff_users')
            .insert({
              agency_id: agencyId,
              username: staffUsername,
              password_hash: passwordHash,
              display_name: ownerName,
              email: ownerEmail,
              team_member_id: tm.id,
              linked_profile_id: purchase.purchased_by,
              is_active: true,
            })
            .select()
            .single();

          if (staffUser) {
            // Create challenge assignment
            await supabaseAdmin.from('challenge_assignments').insert({
              agency_id: agencyId,
              staff_user_id: staffUser.id,
              product_id: purchase.product_id,
              purchase_id: purchase.id,
              assigned_by: purchase.purchased_by,
              start_date: start_date,
              end_date: endDate.toISOString().split('T')[0],
              status: 'pending',
            });

            createdCredentials.push({
              name: `${ownerName} (You)`,
              username: staffUsername,
              password: staffPassword,
            });
          } else if (staffErr) {
            console.error('[challenge-setup-team] Owner staff user creation error:', staffErr);
          }
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
            product_id: purchase.product_id,
            purchase_id: purchase.id,
            assigned_by: purchase.purchased_by,
            start_date: start_date,
            end_date: endDate.toISOString().split('T')[0],
            status: 'pending',
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

      // Create challenge assignment
      await supabaseAdmin.from('challenge_assignments').insert({
        agency_id: agencyId,
        staff_user_id: staffUser.id,
        product_id: purchase.product_id,
        purchase_id: purchase.id,
        assigned_by: purchase.purchased_by,
        start_date: start_date,
        end_date: endDate.toISOString().split('T')[0],
        status: 'pending',
      });

      createdCredentials.push({
        name: member.name,
        username: staffUsername,
        password: staffPassword,
      });
    }

    // 4. Update seats_used on the purchase
    const newSeatsUsed = (purchase.seats_used || 0) + createdCredentials.length;
    await supabaseAdmin
      .from('challenge_purchases')
      .update({ seats_used: newSeatsUsed })
      .eq('id', purchase.id);

    // 5. Send credential emails as backup (if any members have emails)
    const membersWithEmail = createdCredentials.filter((_, i) => {
      const originalMember = i < (self_participating ? 1 : 0)
        ? null // self-participating entry
        : team_members[i - (self_participating ? 1 : 0)];
      return originalMember?.email;
    });

    if (createdCredentials.length > 0) {
      try {
        const { data: agencyData } = await supabaseAdmin
          .from('agencies')
          .select('name')
          .eq('id', agencyId)
          .single();

        await supabaseAdmin.functions.invoke('challenge-send-credentials', {
          body: {
            email: (await supabaseAdmin.auth.admin.getUserById(purchase.purchased_by))?.data?.user?.email || '',
            staff_credentials: createdCredentials,
            agency_name: agencyData?.name || 'Your Agency',
            start_date: start_date,
          },
        });
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
