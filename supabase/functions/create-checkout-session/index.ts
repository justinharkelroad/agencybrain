// Create Stripe Checkout Session for subscription with 7-day trial
// Used for new signups from marketing page

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const {
      agency_id,
      email,
      agency_name,
      user_id,
      success_url,
      cancel_url,
      skip_trial = false  // For users who already had a trial
    } = await req.json()

    if (!agency_id || !email) {
      throw new Error('agency_id and email are required')
    }

    // Check if agency already has a Stripe customer
    const { data: agency } = await supabase
      .from('agencies')
      .select('stripe_customer_id, subscription_status')
      .eq('id', agency_id)
      .single()

    let customerId = agency?.stripe_customer_id

    // Create or retrieve Stripe customer
    if (!customerId) {
      // Check if customer exists by email
      const existingCustomers = await stripe.customers.list({
        email,
        limit: 1
      })

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id

        // Update customer metadata
        await stripe.customers.update(customerId, {
          metadata: {
            agency_id,
            agency_name: agency_name || '',
            user_id: user_id || ''
          }
        })
      } else {
        // Create new customer
        const customer = await stripe.customers.create({
          email,
          name: agency_name || undefined,
          metadata: {
            agency_id,
            agency_name: agency_name || '',
            user_id: user_id || ''
          }
        })
        customerId = customer.id
      }

      // Save customer ID to agency
      await supabase
        .from('agencies')
        .update({ stripe_customer_id: customerId })
        .eq('id', agency_id)
    }

    // Check if they already have an active subscription
    if (agency?.subscription_status === 'active' || agency?.subscription_status === 'trialing') {
      throw new Error('Agency already has an active subscription')
    }

    // Determine if trial should be included
    // Skip trial if they previously had a subscription (canceled, past_due, etc.)
    const hadPreviousSubscription = agency?.subscription_status &&
      ['canceled', 'past_due', 'unpaid'].includes(agency.subscription_status)

    const includeTrial = !skip_trial && !hadPreviousSubscription

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: Deno.env.get('STRIPE_PRICE_ID'),  // $299/month price
        quantity: 1,
      }],
      mode: 'subscription',
      subscription_data: includeTrial ? {
        trial_period_days: 7,
        metadata: { agency_id }
      } : {
        metadata: { agency_id }
      },
      success_url: success_url || `${Deno.env.get('APP_URL')}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${Deno.env.get('APP_URL')}/pricing?checkout=canceled`,
      metadata: {
        agency_id,
        user_id: user_id || ''
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    })

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
