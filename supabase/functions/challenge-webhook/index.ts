import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('Processing checkout.session.completed:', session.id);

      const purchaseId = session.metadata?.purchase_id;
      const source = session.metadata?.source;

      // Handle standalone purchases (no existing account)
      if (source === 'standalone' && !purchaseId) {
        console.log('Standalone purchase detected, invoking setup function');

        // Get tier from metadata or line items
        const tier = session.metadata?.tier || 'Call Scoring';
        const customerEmail = session.customer_details?.email || session.customer_email;
        const quantity = session.metadata?.quantity ? parseInt(session.metadata.quantity, 10) : 1;

        if (!customerEmail) {
          console.error('No customer email for standalone purchase');
          return new Response(
            JSON.stringify({ error: 'Missing customer email' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Invoke the standalone setup function via direct fetch to avoid Deno runtime bug
        const setupPayload = {
          email: customerEmail,
          tier,
          quantity,
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          amount_paid_cents: session.amount_total,
        };
        const setupRes = await fetch(
          `${supabaseUrl}/functions/v1/challenge-standalone-setup`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify(setupPayload),
          }
        );

        if (!setupRes.ok) {
          const errBody = await setupRes.text();
          console.error('Standalone setup error:', setupRes.status, errBody);
          return new Response(
            JSON.stringify({ error: 'Failed to setup standalone purchase' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const setupResult = await setupRes.json();
        console.log('Standalone setup completed:', setupResult);
        return new Response(
          JSON.stringify({ received: true, standalone: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Existing member purchase flow - requires purchase_id
      if (!purchaseId) {
        console.error('No purchase_id in session metadata for member purchase');
        return new Response(
          JSON.stringify({ error: 'Missing purchase_id in metadata' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update purchase status to completed
      const { error: updateError } = await supabase
        .from('challenge_purchases')
        .update({
          status: 'completed',
          stripe_payment_intent_id: session.payment_intent as string,
          purchased_at: new Date().toISOString(),
        })
        .eq('id', purchaseId)
        .eq('status', 'pending'); // Only update if still pending

      if (updateError) {
        console.error('Error updating purchase:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update purchase' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Purchase updated successfully:', purchaseId);
    }

    // Handle payment_intent.payment_failed for potential status update
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      console.log('Payment failed:', paymentIntent.id);

      // Find and update the purchase by payment intent ID
      const { error: updateError } = await supabase
        .from('challenge_purchases')
        .update({ status: 'failed' })
        .eq('stripe_payment_intent_id', paymentIntent.id);

      if (updateError) {
        console.error('Error updating failed purchase:', updateError);
      }
    }

    // Handle refunds
    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;

      console.log('Charge refunded:', charge.id);

      // Find and update the purchase by payment intent ID
      if (charge.payment_intent) {
        const { error: updateError } = await supabase
          .from('challenge_purchases')
          .update({ status: 'refunded' })
          .eq('stripe_payment_intent_id', charge.payment_intent as string);

        if (updateError) {
          console.error('Error updating refunded purchase:', updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
