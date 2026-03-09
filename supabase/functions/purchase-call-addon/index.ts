// Purchase Call Scoring Monthly Add-On
// Creates a Stripe Checkout session for recurring addon subscription

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { verifyRequest, isVerifyError } from '../_shared/verifyRequest.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session, x-staff-session-token',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // JWT-auth only endpoint
    const authResult = await verifyRequest(req)
    if (isVerifyError(authResult) || authResult.mode !== 'supabase' || !authResult.userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const { addon_id, success_url, cancel_url } = await req.json()

    if (!addon_id) {
      throw new Error('addon_id is required')
    }

    // Get user's agency and profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id, full_name, email')
      .eq('id', authResult.userId)
      .single()

    if (!profile?.agency_id) {
      throw new Error('No agency found for user')
    }

    // Get agency's Stripe customer ID and subscription status
    const { data: agency } = await supabase
      .from('agencies')
      .select('stripe_customer_id, subscription_status, name')
      .eq('id', profile.agency_id)
      .single()

    // Must have active subscription to buy addon
    if (!agency?.subscription_status || !['active', 'trialing'].includes(agency.subscription_status)) {
      throw new Error('Active subscription required to purchase monthly add-ons')
    }

    // Create Stripe customer on-the-fly if one doesn't exist
    let stripeCustomerId = agency.stripe_customer_id
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: profile.email || undefined,
        name: agency.name || undefined,
        metadata: {
          agency_id: profile.agency_id,
          supabase_user_id: authResult.userId,
        },
      })
      stripeCustomerId = customer.id

      // Persist for future use
      await supabase
        .from('agencies')
        .update({ stripe_customer_id: customer.id })
        .eq('id', profile.agency_id)

      console.log('Created Stripe customer', customer.id, 'for agency', profile.agency_id)
    }

    // Check for existing active addon subscription
    const { data: existingAddon } = await supabase
      .from('agency_call_addon_subscriptions')
      .select('id, status')
      .eq('agency_id', profile.agency_id)
      .in('status', ['active', 'past_due'])
      .maybeSingle()

    if (existingAddon) {
      throw new Error('You already have an active monthly add-on. Contact support to make changes.')
    }

    // Get addon details
    const { data: addon } = await supabase
      .from('call_scoring_addons')
      .select('*')
      .eq('id', addon_id)
      .eq('is_active', true)
      .single()

    if (!addon) {
      throw new Error('Add-on plan not found')
    }

    if (!addon.stripe_price_id) {
      throw new Error('Add-on plan not configured for purchase yet')
    }

    console.log('Creating checkout with price:', addon.stripe_price_id, 'customer:', stripeCustomerId, 'addon:', addon.calls_per_month, 'calls')

    // Create Stripe checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{
        price: addon.stripe_price_id,
        quantity: 1,
      }],
      mode: 'subscription',
      allow_promotion_codes: true,
      success_url: success_url || `${Deno.env.get('APP_URL')}/settings/billing?addon=success`,
      cancel_url: cancel_url || `${Deno.env.get('APP_URL')}/settings/billing?addon=canceled`,
      subscription_data: {
        metadata: {
          type: 'call_addon',
          agency_id: profile.agency_id,
          addon_id: addon.id,
          calls_per_month: addon.calls_per_month.toString(),
        },
      },
    })

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error creating addon checkout:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
