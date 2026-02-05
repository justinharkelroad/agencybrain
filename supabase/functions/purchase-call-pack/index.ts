// Purchase Call Pack
// Creates a Stripe Checkout session for one-time call pack purchase

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

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { call_pack_id, success_url, cancel_url } = await req.json()

    if (!call_pack_id) {
      throw new Error('call_pack_id is required')
    }

    // Get user's agency and profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id, display_name')
      .eq('id', user.id)
      .single()

    if (!profile?.agency_id) {
      throw new Error('No agency found for user')
    }

    // Get agency's Stripe customer ID
    const { data: agency } = await supabase
      .from('agencies')
      .select('stripe_customer_id, subscription_status')
      .eq('id', profile.agency_id)
      .single()

    // Must have active subscription to buy call packs
    if (!agency?.subscription_status || !['active', 'trialing'].includes(agency.subscription_status)) {
      throw new Error('Active subscription required to purchase call packs')
    }

    if (!agency?.stripe_customer_id) {
      throw new Error('No Stripe customer found')
    }

    // Get call pack details
    const { data: callPack } = await supabase
      .from('call_packs')
      .select('*')
      .eq('id', call_pack_id)
      .eq('is_active', true)
      .single()

    if (!callPack) {
      throw new Error('Call pack not found')
    }

    // Create purchase record (pending)
    const { data: purchase, error: purchaseError } = await supabase
      .from('call_pack_purchases')
      .insert({
        agency_id: profile.agency_id,
        call_pack_id: callPack.id,
        call_count: callPack.call_count,
        price_cents: callPack.price_cents,
        status: 'pending',
        purchased_by: user.id
      })
      .select()
      .single()

    if (purchaseError) {
      throw new Error('Failed to create purchase record')
    }

    // Create Stripe checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: agency.stripe_customer_id,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: callPack.name,
            description: callPack.description || `Add ${callPack.call_count} call scores to your account`,
          },
          unit_amount: callPack.price_cents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: success_url || `${Deno.env.get('APP_URL')}/call-scoring?purchase=success`,
      cancel_url: cancel_url || `${Deno.env.get('APP_URL')}/call-scoring?purchase=canceled`,
      metadata: {
        agency_id: profile.agency_id,
        call_pack_id: callPack.id,
        call_count: callPack.call_count.toString(),
        purchase_id: purchase.id
      }
    })

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id,
        purchase_id: purchase.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error creating call pack checkout:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
