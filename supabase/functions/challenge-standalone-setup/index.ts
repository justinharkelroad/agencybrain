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
    const { email, quantity = 1, stripe_session_id, stripe_payment_intent_id, amount_paid_cents } = input;

    console.log('[challenge-standalone-setup] Starting setup:', { email, quantity, stripe_session_id });

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Check if email already exists as auth user
    // Use targeted lookup instead of listUsers() which has pagination limits
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (existingProfile) {
      console.log('[challenge-standalone-setup] User already exists (profile match):', existingProfile.id);
      return new Response(
        JSON.stringify({
          error: 'An account with this email already exists. Please sign in at myagencybrain.com to purchase.',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Generate a temporary password (user will set their own via recovery link)
    const ownerPassword = generatePassword();

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

    // 4. Create auth user (owner) with Six Week Challenge tier
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
      await supabaseAdmin.from('agencies').delete().eq('id', agency.id);
      // Handle duplicate email that wasn't caught by profile check
      const isDuplicate = userError.message?.toLowerCase().includes('already') ||
                         userError.message?.toLowerCase().includes('duplicate') ||
                         userError.message?.toLowerCase().includes('registered');
      if (isDuplicate) {
        return new Response(
          JSON.stringify({ error: 'An account with this email already exists. Please sign in at myagencybrain.com to purchase.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to create user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[challenge-standalone-setup] Auth user created:', newUser.user.id);

    // 5. Update profile with agency link and Six Week Challenge membership tier
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        agency_id: agency.id,
        membership_tier: 'Six Week Challenge',
      })
      .eq('id', newUser.user.id);

    if (profileError) {
      console.error('[challenge-standalone-setup] Profile update error:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      await supabaseAdmin.from('agencies').delete().eq('id', agency.id);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Generate Supabase recovery link so the buyer can set their own password
    const siteUrl = Deno.env.get('SITE_URL') || 'https://myagencybrain.com';
    let ownerSetupUrl = '';
    try {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${siteUrl}/reset-password`,
        }
      });

      if (linkError) {
        console.error('[challenge-standalone-setup] Recovery link generation error:', linkError);
      } else if (linkData?.properties?.action_link) {
        ownerSetupUrl = linkData.properties.action_link;
        console.log('[challenge-standalone-setup] Recovery link generated');
      }
    } catch (linkErr) {
      console.error('[challenge-standalone-setup] Recovery link error:', linkErr);
    }

    // 7. Get challenge product
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

    // 8. Create challenge_purchases record
    // seats_used starts at 0 — the buyer will assign team members after logging in
    const startDate = getNextMonday();
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('challenge_purchases')
      .insert({
        agency_id: agency.id,
        product_id: product.id,
        purchased_by: newUser.user.id,
        quantity,
        seats_used: 0,
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

    // 9. Write to challenge_setup_results for the success page to poll
    if (stripe_session_id) {
      const { error: setupResultError } = await supabaseAdmin
        .from('challenge_setup_results')
        .insert({
          stripe_session_id,
          agency_id: agency.id,
          user_id: newUser.user.id,
          email,
          staff_credentials: [], // No staff created yet — buyer assigns team after login
          owner_setup_url: ownerSetupUrl,
          purchase_id: purchase.id,
          quantity,
          start_date: startDate.toISOString().split('T')[0],
        });

      if (setupResultError) {
        console.error('[challenge-standalone-setup] Setup results write error:', setupResultError);
        // Non-fatal — the purchase is still valid
      }
    }

    // 10. Send welcome email with owner setup link as backup
    // Use direct fetch instead of supabase.functions.invoke() to avoid Deno runtime bug
    try {
      const credentialsPayload = {
        email,
        staff_credentials: [], // No staff credentials yet
        agency_name: agencyName,
        start_date: startDate.toISOString().split('T')[0],
        owner_setup_url: ownerSetupUrl,
        quantity,
      };
      const emailRes = await fetch(
        `${supabaseUrl}/functions/v1/challenge-send-credentials`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify(credentialsPayload),
        }
      );
      if (!emailRes.ok) {
        const errBody = await emailRes.text();
        console.error('[challenge-standalone-setup] Email send failed:', emailRes.status, errBody);
      } else {
        console.log('[challenge-standalone-setup] Welcome email sent');
      }
    } catch (emailError) {
      console.error('[challenge-standalone-setup] Email send error:', emailError);
      // Don't fail the whole operation if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        agency_id: agency.id,
        user_id: newUser.user.id,
        purchase_id: purchase.id,
        start_date: startDate.toISOString().split('T')[0],
        quantity,
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
