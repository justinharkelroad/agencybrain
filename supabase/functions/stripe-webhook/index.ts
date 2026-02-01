// Stripe Webhook Handler
// Syncs subscription status, handles call pack purchases, and sends emails

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BRAND, buildEmailHtml, EmailComponents } from '../_shared/email-template.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SITE_URL = Deno.env.get('SITE_URL') || 'https://myagencybrain.com'

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  try {
    const body = await req.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

    let event: Stripe.Event

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }

    console.log(`Processing webhook event: ${event.type}`)

    switch (event.type) {
      // ===========================================
      // SUBSCRIPTION EVENTS
      // ===========================================

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      // ===========================================
      // CHECKOUT EVENTS (for call packs)
      // ===========================================

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Check if this is a call pack purchase (one-time payment)
        if (session.mode === 'payment' && session.metadata?.call_pack_id) {
          await handleCallPackPurchase(session)
        }
        break
      }

      // ===========================================
      // INVOICE EVENTS
      // ===========================================

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice

        // If this is a subscription renewal, reset monthly calls
        if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
          await handleSubscriptionRenewal(invoice)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Webhook handler error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})

// ===========================================
// HANDLER FUNCTIONS
// ===========================================

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const agency_id = subscription.metadata?.agency_id
  const customerId = subscription.customer as string

  if (!agency_id) {
    // Try to find agency by customer ID
    const { data: agency } = await supabase
      .from('agencies')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()

    if (!agency) {
      console.error('Could not find agency for subscription:', subscription.id)
      return
    }
  }

  const agencyId = agency_id || (await getAgencyByCustomerId(customerId))

  if (!agencyId) {
    console.error('Could not determine agency_id for subscription')
    return
  }

  // Upsert subscription record
  const { error: subError } = await supabase
    .from('subscriptions')
    .upsert({
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      agency_id: agencyId,
      status: subscription.status,
      price_id: subscription.items.data[0]?.price?.id || null,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_start: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'stripe_subscription_id'
    })

  if (subError) {
    console.error('Error upserting subscription:', subError)
  }

  // Update agency subscription status
  const { error: agencyError } = await supabase
    .from('agencies')
    .update({
      stripe_customer_id: customerId,
      subscription_status: subscription.status
    })
    .eq('id', agencyId)

  if (agencyError) {
    console.error('Error updating agency status:', agencyError)
  }

  // Set up call balance based on subscription status
  const callLimit = subscription.status === 'active' ? 20 :
                    subscription.status === 'trialing' ? 3 : 0

  const periodStart = subscription.status === 'trialing' && subscription.trial_start
    ? new Date(subscription.trial_start * 1000).toISOString().split('T')[0]
    : new Date(subscription.current_period_start * 1000).toISOString().split('T')[0]

  const { error: balanceError } = await supabase
    .from('agency_call_balance')
    .upsert({
      agency_id: agencyId,
      subscription_calls_limit: callLimit,
      subscription_calls_used: 0,
      subscription_period_start: periodStart
    }, {
      onConflict: 'agency_id'
    })

  if (balanceError) {
    console.error('Error setting call balance:', balanceError)
  }

  console.log(`Subscription ${subscription.id} updated: status=${subscription.status}, agency=${agencyId}`)

  // Send welcome email for new trials
  if (subscription.status === 'trialing' && subscription.trial_end) {
    const trialEndDate = new Date(subscription.trial_end * 1000)
    await sendTrialWelcomeEmail(agencyId, trialEndDate)
  }

  // Send activation email when trial converts to active
  if (subscription.status === 'active') {
    // Check if this is a conversion from trial (not a renewal)
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('stripe_subscription_id', subscription.id)
      .single()

    // If previous status was trialing, send activation email
    if (existingSub?.status === 'trialing') {
      await sendTrialActivatedEmail(agencyId)
    }
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const agencyId = subscription.metadata?.agency_id || await getAgencyByCustomerId(customerId)

  if (!agencyId) {
    console.error('Could not find agency for deleted subscription')
    return
  }

  // Update subscription record
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  // Update agency status
  await supabase
    .from('agencies')
    .update({ subscription_status: 'canceled' })
    .eq('id', agencyId)

  // Zero out subscription calls (purchased calls remain)
  await supabase
    .from('agency_call_balance')
    .update({
      subscription_calls_limit: 0,
      subscription_calls_used: 0
    })
    .eq('agency_id', agencyId)

  console.log(`Subscription canceled for agency ${agencyId}`)

  // Send cancellation email
  await sendSubscriptionCanceledEmail(agencyId)
}

async function handleSubscriptionRenewal(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  const agencyId = await getAgencyByCustomerId(customerId)

  if (!agencyId) {
    console.error('Could not find agency for renewal')
    return
  }

  // Reset monthly call allowance
  const periodStart = invoice.period_start
    ? new Date(invoice.period_start * 1000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  await supabase
    .from('agency_call_balance')
    .update({
      subscription_calls_used: 0,
      subscription_calls_limit: 20,
      subscription_period_start: periodStart,
      updated_at: new Date().toISOString()
    })
    .eq('agency_id', agencyId)

  console.log(`Monthly calls reset for agency ${agencyId}`)
}

async function handleCallPackPurchase(session: Stripe.Checkout.Session) {
  const agencyId = session.metadata?.agency_id
  const callPackId = session.metadata?.call_pack_id
  const callCount = parseInt(session.metadata?.call_count || '0')

  if (!agencyId || !callCount) {
    console.error('Missing metadata for call pack purchase')
    return
  }

  // Record the purchase
  await supabase
    .from('call_pack_purchases')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent as string
    })
    .eq('id', session.metadata?.purchase_id)

  // Add calls to balance
  const { data: balance } = await supabase
    .from('agency_call_balance')
    .select('purchased_calls_remaining')
    .eq('agency_id', agencyId)
    .single()

  const currentPurchased = balance?.purchased_calls_remaining || 0

  await supabase
    .from('agency_call_balance')
    .upsert({
      agency_id: agencyId,
      purchased_calls_remaining: currentPurchased + callCount,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'agency_id'
    })

  console.log(`Added ${callCount} calls to agency ${agencyId}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  const agencyId = await getAgencyByCustomerId(customerId)

  if (!agencyId) return

  // Update subscription status
  if (invoice.subscription) {
    await supabase
      .from('subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription as string)

    await supabase
      .from('agencies')
      .update({ subscription_status: 'past_due' })
      .eq('id', agencyId)
  }

  // Send payment failed email
  await sendPaymentFailedEmail(agencyId)

  console.log(`Payment failed for agency ${agencyId}`)
}

// Helper to get agency ID from Stripe customer ID
async function getAgencyByCustomerId(customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('agencies')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  return data?.id || null
}

// ===========================================
// EMAIL FUNCTIONS
// ===========================================

async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured, skipping email')
    return false
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: BRAND.fromEmail,
        to: [to],
        subject,
        html,
        text,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Resend API error:', error)
      return false
    }

    console.log('Email sent successfully to:', to)
    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

async function sendTrialWelcomeEmail(agencyId: string, trialEndDate: Date) {
  // Get agency owner info
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, display_name')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!profile?.email) {
    console.error('No email found for agency owner')
    return
  }

  const { data: agency } = await supabase
    .from('agencies')
    .select('name')
    .eq('id', agencyId)
    .single()

  const name = profile.full_name || profile.display_name || 'there'
  const agencyName = agency?.name || 'your agency'
  const trialEndFormatted = trialEndDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const bodyContent = `
    ${EmailComponents.paragraph(`Hi ${name}! 👋`)}

    ${EmailComponents.summaryBox(`Welcome to Agency Brain! Your 7-day free trial for <strong>${agencyName}</strong> has started.`)}

    ${EmailComponents.paragraph(`Your trial gives you full access to explore everything Agency Brain has to offer. Here's how to get the most out of your trial:`)}

    <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 16px 0; color: #1e293b;">🚀 Quick Start Checklist</h3>
      <ul style="margin: 0; padding-left: 20px; color: #475569;">
        <li style="margin-bottom: 8px;"><strong>Set up your scorecards</strong> – Track daily KPIs for your team</li>
        <li style="margin-bottom: 8px;"><strong>Try AI call scoring</strong> – Get instant feedback on sales calls (3 included)</li>
        <li style="margin-bottom: 8px;"><strong>Explore the training platform</strong> – Access the Standard Playbook</li>
        <li style="margin-bottom: 8px;"><strong>Add your team</strong> – Invite staff members to their own portal</li>
      </ul>
    </div>

    ${EmailComponents.button('Go to Dashboard', `${SITE_URL}/dashboard`)}

    ${EmailComponents.paragraph(`<strong>Your trial ends on ${trialEndFormatted}.</strong> Your card will automatically be charged $299/month to continue your subscription – no action needed!`)}

    ${EmailComponents.infoText(`Questions? Reply to this email or visit our help center. We're here to help you succeed!`)}
  `

  const html = buildEmailHtml({
    title: '🎉 Welcome to Agency Brain!',
    subtitle: 'Your 7-day free trial has started',
    bodyContent,
    footerAgencyName: agencyName,
  })

  const text = `Hi ${name}!

Welcome to Agency Brain! Your 7-day free trial for ${agencyName} has started.

Quick Start Checklist:
• Set up your scorecards – Track daily KPIs for your team
• Try AI call scoring – Get instant feedback on sales calls (3 included)
• Explore the training platform – Access the Standard Playbook
• Add your team – Invite staff members to their own portal

Go to your dashboard: ${SITE_URL}/dashboard

Your trial ends on ${trialEndFormatted}. Your card will automatically be charged $299/month to continue your subscription – no action needed!

Questions? Reply to this email – we're here to help!

— The Agency Brain Team`

  await sendEmail(
    profile.email,
    '🎉 Welcome to Agency Brain! Your trial has started',
    html,
    text
  )
}

async function sendTrialActivatedEmail(agencyId: string) {
  // Get agency owner info
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, display_name')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!profile?.email) {
    console.error('No email found for agency owner')
    return
  }

  const { data: agency } = await supabase
    .from('agencies')
    .select('name')
    .eq('id', agencyId)
    .single()

  const name = profile.full_name || profile.display_name || 'there'
  const agencyName = agency?.name || 'your agency'

  const bodyContent = `
    ${EmailComponents.paragraph(`Hi ${name}! 🎉`)}

    ${EmailComponents.summaryBox(`Your subscription for <strong>${agencyName}</strong> is now active!`)}

    ${EmailComponents.paragraph(`Thank you for subscribing to Agency Brain. You now have full access to:`)}

    <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #22c55e;">
      <ul style="margin: 0; padding-left: 20px; color: #166534;">
        <li style="margin-bottom: 8px;">✅ Unlimited scorecards & custom KPIs</li>
        <li style="margin-bottom: 8px;">✅ 20 AI call scoring credits per month</li>
        <li style="margin-bottom: 8px;">✅ Full Standard Playbook training access</li>
        <li style="margin-bottom: 8px;">✅ Custom training platform</li>
        <li style="margin-bottom: 8px;">✅ Comp analyzer & bonus tools</li>
        <li style="margin-bottom: 8px;">✅ Cancel audit & Winback HQ</li>
        <li style="margin-bottom: 8px;">✅ Unlimited team members</li>
      </ul>
    </div>

    ${EmailComponents.button('Go to Dashboard', `${SITE_URL}/dashboard`)}

    ${EmailComponents.infoText(`Need more call scoring credits? You can purchase additional packs anytime in the app.`)}
  `

  const html = buildEmailHtml({
    title: '✅ Subscription Activated!',
    subtitle: 'You now have full access to Agency Brain',
    bodyContent,
    footerAgencyName: agencyName,
  })

  const text = `Hi ${name}!

Your subscription for ${agencyName} is now active!

You now have full access to:
• Unlimited scorecards & custom KPIs
• 20 AI call scoring credits per month
• Full Standard Playbook training access
• Custom training platform
• Comp analyzer & bonus tools
• Cancel audit & Winback HQ
• Unlimited team members

Go to your dashboard: ${SITE_URL}/dashboard

Need more call scoring credits? You can purchase additional packs anytime in the app.

— The Agency Brain Team`

  await sendEmail(
    profile.email,
    '✅ Your Agency Brain subscription is active!',
    html,
    text
  )
}

async function sendSubscriptionCanceledEmail(agencyId: string) {
  // Get agency owner info
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, display_name')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!profile?.email) {
    console.error('No email found for agency owner')
    return
  }

  const { data: agency } = await supabase
    .from('agencies')
    .select('name')
    .eq('id', agencyId)
    .single()

  const name = profile.full_name || profile.display_name || 'there'
  const agencyName = agency?.name || 'your agency'

  const bodyContent = `
    ${EmailComponents.paragraph(`Hi ${name},`)}

    ${EmailComponents.paragraph(`We're sorry to see you go. Your Agency Brain subscription for <strong>${agencyName}</strong> has been canceled.`)}

    ${EmailComponents.paragraph(`Your data is safe and will be kept for 30 days. If you change your mind, you can reactivate anytime and pick up right where you left off.`)}

    <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0; font-weight: 600;">What you'll get when you come back:</p>
      <ul style="margin: 0; padding-left: 20px; color: #475569;">
        <li style="margin-bottom: 8px;">All your existing data and configurations</li>
        <li style="margin-bottom: 8px;">20 AI call scoring credits per month</li>
        <li style="margin-bottom: 8px;">Full access to all features</li>
      </ul>
    </div>

    ${EmailComponents.button('Reactivate Subscription', `${SITE_URL}/settings/billing`)}

    ${EmailComponents.infoText(`We'd love to hear your feedback. Reply to this email and let us know how we can improve!`)}
  `

  const html = buildEmailHtml({
    title: 'Subscription Canceled',
    subtitle: `Your data is safe for 30 days`,
    bodyContent,
    footerAgencyName: agencyName,
  })

  const text = `Hi ${name},

We're sorry to see you go. Your Agency Brain subscription for ${agencyName} has been canceled.

Your data is safe and will be kept for 30 days. If you change your mind, you can reactivate anytime and pick up right where you left off.

What you'll get when you come back:
• All your existing data and configurations
• 20 AI call scoring credits per month
• Full access to all features

Reactivate: ${SITE_URL}/settings/billing

We'd love to hear your feedback. Reply to this email and let us know how we can improve!

— The Agency Brain Team`

  await sendEmail(
    profile.email,
    'Your Agency Brain subscription has been canceled',
    html,
    text
  )
}

async function sendPaymentFailedEmail(agencyId: string) {
  // Get agency owner info
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, display_name')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!profile?.email) {
    console.error('No email found for agency owner')
    return
  }

  const { data: agency } = await supabase
    .from('agencies')
    .select('name')
    .eq('id', agencyId)
    .single()

  const name = profile.full_name || profile.display_name || 'there'
  const agencyName = agency?.name || 'your agency'

  const bodyContent = `
    ${EmailComponents.paragraph(`Hi ${name},`)}

    <div style="background: #fef2f2; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ef4444;">
      <strong style="color: #dc2626;">⚠️ We couldn't process your payment</strong>
      <p style="margin: 8px 0 0 0; color: #7f1d1d;">Please update your payment method to avoid losing access to Agency Brain.</p>
    </div>

    ${EmailComponents.paragraph(`Your subscription for <strong>${agencyName}</strong> is now past due. To continue using Agency Brain without interruption, please update your payment information.`)}

    ${EmailComponents.button('Update Payment Method', `${SITE_URL}/settings/billing`)}

    ${EmailComponents.infoText(`If you believe this is an error, please contact your bank or reply to this email for assistance.`)}
  `

  const html = buildEmailHtml({
    title: '⚠️ Payment Failed',
    subtitle: `Action required to keep your access`,
    bodyContent,
    footerAgencyName: agencyName,
  })

  const text = `Hi ${name},

We couldn't process your payment for Agency Brain.

Your subscription for ${agencyName} is now past due. To continue using Agency Brain without interruption, please update your payment information.

Update your payment method: ${SITE_URL}/settings/billing

If you believe this is an error, please contact your bank or reply to this email for assistance.

— The Agency Brain Team`

  await sendEmail(
    profile.email,
    '⚠️ Payment failed - action required',
    html,
    text
  )
}
