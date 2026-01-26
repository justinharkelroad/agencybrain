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

  // Format: pbkdf2_sha256$100000$salt$hash
  return `pbkdf2_sha256$100000$${saltHex}$${hashHex}`;
}

// Calculate next Monday from today
function getNextMonday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}

// Calculate end date (6 weeks from start, ending on Friday)
function getChallengeEndDate(startDate: Date): Date {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 32); // 6 weeks * 5 days + buffer
  return endDate;
}

// Map tier names to membership_tier values
function mapTierToMembership(tier: string): string {
  const tierMap: Record<string, string> = {
    'Call Scoring': 'Call Scoring',
    'call_scoring': 'Call Scoring',
    'Boardroom': 'Boardroom',
    'boardroom': 'Boardroom',
    '1:1 Coaching': '1:1 Coaching',
    'one_on_one': '1:1 Coaching',
    'oneOnOne': '1:1 Coaching',
  };
  return tierMap[tier] || 'Call Scoring';
}

interface StandaloneSetupInput {
  email: string;
  tier: string;
  quantity: number;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  amount_paid_cents: number | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: StandaloneSetupInput = await req.json();
    const { email, tier, quantity = 1, stripe_session_id, stripe_payment_intent_id, amount_paid_cents } = input;

    console.log('[challenge-standalone-setup] Starting setup:', { email, tier, quantity });

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Check if email already exists as auth user
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      console.log('[challenge-standalone-setup] User already exists:', existingUser.id);
      return new Response(
        JSON.stringify({
          error: 'An account with this email already exists. Please sign in at myagencybrain.com to purchase.',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Generate credentials
    const ownerPassword = generatePassword();
    const membershipTier = mapTierToMembership(tier);

    // 3. Create agency
    const agencyName = `${email.split('@')[0]}'s Agency`;
    const { data: agency, error: agencyError } = await supabaseAdmin
      .from('agencies')
      .insert({
        name: agencyName,
        description: 'Created via 6-Week Challenge standalone purchase',
      })
      .select()
      .single();

    if (agencyError) {
      console.error('[challenge-standalone-setup] Agency creation error:', agencyError);
      return new Response(
        JSON.stringify({ error: 'Failed to create agency' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[challenge-standalone-setup] Agency created:', agency.id);

    // 4. Create auth user (owner)
    const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: {
        first_name: email.split('@')[0],
        last_name: '',
      }
    });

    if (userError) {
      console.error('[challenge-standalone-setup] User creation error:', userError);
      // Clean up agency
      await supabaseAdmin.from('agencies').delete().eq('id', agency.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[challenge-standalone-setup] Auth user created:', newUser.user.id);

    // 5. Update profile with agency link and membership tier
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        agency_id: agency.id,
        membership_tier: membershipTier,
      })
      .eq('id', newUser.user.id);

    if (profileError) {
      console.error('[challenge-standalone-setup] Profile update error:', profileError);
      // Clean up
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      await supabaseAdmin.from('agencies').delete().eq('id', agency.id);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Get challenge product
    const { data: product, error: productError } = await supabaseAdmin
      .from('challenge_products')
      .select('id')
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      console.error('[challenge-standalone-setup] Product fetch error:', productError);
      return new Response(
        JSON.stringify({ error: 'Challenge product not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Create challenge_purchases record
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('challenge_purchases')
      .insert({
        agency_id: agency.id,
        product_id: product.id,
        purchased_by: newUser.user.id,
        quantity,
        seats_used: quantity, // All seats will be used immediately
        price_per_seat_cents: amount_paid_cents ? Math.round(amount_paid_cents / quantity) : 0,
        total_price_cents: amount_paid_cents || 0,
        status: 'completed',
        stripe_payment_intent_id: stripe_payment_intent_id,
        purchased_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (purchaseError) {
      console.error('[challenge-standalone-setup] Purchase creation error:', purchaseError);
      return new Response(
        JSON.stringify({ error: 'Failed to create purchase record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[challenge-standalone-setup] Purchase created:', purchase.id);

    // 8. Create staff users and assignments for each seat
    const startDate = getNextMonday();
    const endDate = getChallengeEndDate(startDate);
    const createdStaff: Array<{ username: string; password: string; email: string }> = [];

    for (let i = 0; i < quantity; i++) {
      const staffPassword = generatePassword();
      const staffUsername = quantity === 1
        ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
        : `${email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}${i + 1}`;

      // Create team member
      const { data: teamMember, error: tmError } = await supabaseAdmin
        .from('team_members')
        .insert({
          agency_id: agency.id,
          name: quantity === 1 ? email.split('@')[0] : `Team Member ${i + 1}`,
          email: quantity === 1 ? email : null,
          role: 'Sales',
          status: 'active',
          employment: 'Full-time',
        })
        .select()
        .single();

      if (tmError) {
        console.error('[challenge-standalone-setup] Team member creation error:', tmError);
        continue;
      }

      // Hash password
      const passwordHash = await hashPassword(staffPassword);

      // Create staff user
      const { data: staffUser, error: staffError } = await supabaseAdmin
        .from('staff_users')
        .insert({
          agency_id: agency.id,
          username: staffUsername,
          password_hash: passwordHash,
          display_name: teamMember.name,
          email: quantity === 1 ? email : null,
          team_member_id: teamMember.id,
          is_active: true,
        })
        .select()
        .single();

      if (staffError) {
        console.error('[challenge-standalone-setup] Staff user creation error:', staffError);
        // Try alternative username if conflict
        if (staffError.code === '23505') {
          const altUsername = `${staffUsername}${Date.now().toString(36)}`;
          const { data: altStaff, error: altError } = await supabaseAdmin
            .from('staff_users')
            .insert({
              agency_id: agency.id,
              username: altUsername,
              password_hash: passwordHash,
              display_name: teamMember.name,
              email: quantity === 1 ? email : null,
              team_member_id: teamMember.id,
              is_active: true,
            })
            .select()
            .single();

          if (altError) continue;
          createdStaff.push({ username: altUsername, password: staffPassword, email: email });

          // Create challenge assignment
          await supabaseAdmin.from('challenge_assignments').insert({
            staff_user_id: altStaff.id,
            product_id: product.id,
            purchase_id: purchase.id,
            assigned_by: newUser.user.id,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            status: 'pending',
          });
          continue;
        }
        continue;
      }

      createdStaff.push({ username: staffUsername, password: staffPassword, email: email });

      // Create challenge assignment
      const { error: assignError } = await supabaseAdmin
        .from('challenge_assignments')
        .insert({
          staff_user_id: staffUser.id,
          product_id: product.id,
          purchase_id: purchase.id,
          assigned_by: newUser.user.id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          status: 'pending',
        });

      if (assignError) {
        console.error('[challenge-standalone-setup] Assignment creation error:', assignError);
      }
    }

    console.log('[challenge-standalone-setup] Created staff users:', createdStaff.length);

    // 9. Send welcome email with credentials
    if (createdStaff.length > 0) {
      try {
        await supabaseAdmin.functions.invoke('challenge-send-credentials', {
          body: {
            email,
            staff_credentials: createdStaff,
            agency_name: agencyName,
            start_date: startDate.toISOString().split('T')[0],
          },
        });
        console.log('[challenge-standalone-setup] Credentials email sent');
      } catch (emailError) {
        console.error('[challenge-standalone-setup] Email send error:', emailError);
        // Don't fail the whole operation if email fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        agency_id: agency.id,
        user_id: newUser.user.id,
        purchase_id: purchase.id,
        staff_count: createdStaff.length,
        start_date: startDate.toISOString().split('T')[0],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[challenge-standalone-setup] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
