import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_CHALLENGE_WEBHOOK_SECRET') || Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

const ADMIN_NOTIFICATION_EMAIL = 'justin@hfiagencies.com';

interface PurchaseNotification {
  purchaserEmail: string;
  agencyName: string | null;
  quantity: number;
  totalCents: number;
  tier: string;
  isStandalone: boolean;
}

async function sendPurchaseNotification(info: PurchaseNotification) {
  try {
    const totalDollars = (info.totalCents / 100).toFixed(2);
    const purchaseType = info.isStandalone ? 'Standalone (New Account)' : 'Existing Member';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #1e283a; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px;">New Challenge Purchase</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #60626c; font-size: 14px;">Purchaser</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${info.purchaserEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #60626c; font-size: 14px;">Agency</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${info.agencyName || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #60626c; font-size: 14px;">Type</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${purchaseType}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #60626c; font-size: 14px;">Tier</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${info.tier}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #60626c; font-size: 14px;">Seats</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${info.quantity}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #60626c; font-size: 14px;">Total Paid</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #16a34a;">$${totalDollars}</td>
            </tr>
          </table>
        </div>
        <div style="padding: 16px 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #60626c;">Agency Brain — Challenge Purchase Notification</p>
        </div>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Agency Brain <info@agencybrain.standardplaybook.com>',
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `New Challenge Purchase: ${info.quantity} seat(s) — $${totalDollars}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Failed to send purchase notification email:', res.status, errText);
    } else {
      console.log('Purchase notification email sent to', ADMIN_NOTIFICATION_EMAIL);
    }
  } catch (err) {
    console.error('Error sending purchase notification email:', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
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

    // Verify webhook signature (must use constructEventAsync for Deno compatibility)
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
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

        // Send admin notification (awaited so Deno doesn't kill the isolate before it completes)
        await sendPurchaseNotification({
          purchaserEmail: customerEmail,
          agencyName: setupResult.agency_name || null,
          quantity,
          totalCents: session.amount_total || 0,
          tier,
          isStandalone: true,
        });

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

      // Fetch purchase details + purchaser profile for admin notification
      const { data: purchase } = await supabase
        .from('challenge_purchases')
        .select('quantity, total_price_cents, membership_tier, purchaser_id')
        .eq('id', purchaseId)
        .single();

      if (purchase) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, agencies(name)')
          .eq('id', purchase.purchaser_id)
          .single();

        const agencyName = (profile?.agencies as any)?.name || null;

        // Send admin notification (awaited so Deno doesn't kill the isolate before it completes)
        await sendPurchaseNotification({
          purchaserEmail: profile?.email || 'unknown',
          agencyName,
          quantity: purchase.quantity || 1,
          totalCents: purchase.total_price_cents || 0,
          tier: purchase.membership_tier || 'Unknown',
          isStandalone: false,
        });
      }
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
