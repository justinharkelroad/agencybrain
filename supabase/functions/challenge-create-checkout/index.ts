import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');

    // Create Supabase client with user's JWT for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    // Verify JWT and get user — MUST pass jwt explicitly (throwaway clients have no session)
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { product_id, quantity, success_url, cancel_url } = await req.json();

    if (!product_id || !quantity || quantity < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid product_id or quantity' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's profile to determine agency and membership tier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, agency_id, membership_tier, email, full_name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.agency_id) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found or no agency' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the challenge product
    const { data: product, error: productError } = await supabase
      .from('challenge_products')
      .select('*')
      .eq('id', product_id)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      console.error('Product error:', productError);
      return new Response(
        JSON.stringify({ error: 'Challenge product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate price based on membership tier
    let pricePerSeatCents: number;
    const tier = profile.membership_tier;

    if (tier === '1:1 Coaching') {
      pricePerSeatCents = product.price_one_on_one_cents;
    } else if (tier === 'Boardroom') {
      pricePerSeatCents = product.price_boardroom_cents;
    } else {
      pricePerSeatCents = product.price_standalone_cents;
    }

    const totalPriceCents = pricePerSeatCents * quantity;

    // Create pending purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('challenge_purchases')
      .insert({
        agency_id: profile.agency_id,
        challenge_product_id: product.id,
        purchaser_id: profile.id,
        quantity: quantity,
        price_per_seat_cents: pricePerSeatCents,
        total_price_cents: totalPriceCents,
        membership_tier: tier,
        status: 'pending',
      })
      .select()
      .single();

    if (purchaseError || !purchase) {
      console.error('Purchase creation error:', purchaseError);
      return new Response(
        JSON.stringify({ error: 'Failed to create purchase record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: profile.email || user.email,
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${product.name} - ${quantity} seat${quantity > 1 ? 's' : ''}`,
              description: `${product.duration_weeks}-week staff development program`,
            },
            unit_amount: pricePerSeatCents,
          },
          quantity: quantity,
        },
      ],
      metadata: {
        purchase_id: purchase.id,
        agency_id: profile.agency_id,
        product_id: product.id,
        quantity: quantity.toString(),
        membership_tier: tier || 'standalone',
      },
      success_url: success_url || `${req.headers.get('origin')}/training/challenge/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/training/challenge`,
    });

    // Update purchase with Stripe checkout session ID
    await supabase
      .from('challenge_purchases')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', purchase.id);

    console.log('Checkout session created:', session.id, 'for purchase:', purchase.id);

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: session.url,
        session_id: session.id,
        purchase_id: purchase.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout creation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
