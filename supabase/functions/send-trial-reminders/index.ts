// Send Trial Reminder Emails
// Cron job that runs daily to send reminder emails:
// - 3 days before trial ends
// - 1 day before trial ends
// - Day trial ends (if not converted)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BRAND, buildEmailHtml, EmailComponents } from '../_shared/email-template.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SITE_URL = Deno.env.get('SITE_URL') || 'https://myagencybrain.com'

serve(async (req) => {
  try {
    // This can be called via cron or manually
    const now = new Date()
    const results = {
      threeDayReminders: 0,
      oneDayReminders: 0,
      errors: [] as string[],
    }

    // Get all trialing subscriptions
    const { data: trialingSubs, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        agency_id,
        trial_end,
        stripe_subscription_id
      `)
      .eq('status', 'trialing')
      .not('trial_end', 'is', null)

    if (subError) {
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`)
    }

    console.log(`Found ${trialingSubs?.length || 0} trialing subscriptions`)

    for (const sub of trialingSubs || []) {
      try {
        const trialEnd = new Date(sub.trial_end)
        const daysUntilEnd = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        console.log(`Agency ${sub.agency_id}: ${daysUntilEnd} days until trial ends`)

        // Check if we've already sent a reminder for this milestone
        const { data: existingReminder } = await supabase
          .from('trial_reminder_log')
          .select('id')
          .eq('subscription_id', sub.id)
          .eq('days_remaining', daysUntilEnd)
          .single()

        if (existingReminder) {
          console.log(`Already sent ${daysUntilEnd}-day reminder for ${sub.agency_id}`)
          continue
        }

        // Get agency owner info
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, display_name')
          .eq('agency_id', sub.agency_id)
          .order('created_at', { ascending: true })
          .limit(1)
          .single()

        if (!profile?.email) {
          console.warn(`No email found for agency ${sub.agency_id}`)
          continue
        }

        const { data: agency } = await supabase
          .from('agencies')
          .select('name')
          .eq('id', sub.agency_id)
          .single()

        const name = profile.full_name || profile.display_name || 'there'
        const agencyName = agency?.name || 'your agency'

        // Send appropriate reminder
        // Note: By the time trial actually ends (day 0), the subscription status
        // will have changed to 'active', 'canceled', or 'past_due' - so we only
        // need to handle the reminder emails here. Conversion/cancellation emails
        // are handled by the stripe-webhook.
        if (daysUntilEnd === 3) {
          await sendThreeDayReminder(profile.email, name, agencyName, trialEnd)
          results.threeDayReminders++
        } else if (daysUntilEnd === 1) {
          await sendOneDayReminder(profile.email, name, agencyName, trialEnd)
          results.oneDayReminders++
        } else {
          continue // No reminder needed
        }

        // Log that we sent this reminder
        await supabase
          .from('trial_reminder_log')
          .insert({
            subscription_id: sub.id,
            agency_id: sub.agency_id,
            days_remaining: daysUntilEnd,
            sent_at: now.toISOString(),
          })

      } catch (error) {
        const errorMsg = `Error processing ${sub.agency_id}: ${error.message}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }

    console.log('Trial reminder results:', results)

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in send-trial-reminders:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})

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

async function sendThreeDayReminder(email: string, name: string, agencyName: string, trialEnd: Date) {
  const endDateFormatted = trialEnd.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const bodyContent = `
    ${EmailComponents.paragraph(`Hi ${name},`)}

    ${EmailComponents.summaryBox(`⏰ Your Agency Brain trial ends in <strong>3 days</strong> (${endDateFormatted})`)}

    ${EmailComponents.paragraph(`We hope you've been enjoying Agency Brain! Your subscription will automatically continue at <strong>$299/month</strong> after your trial ends.`)}

    ${EmailComponents.paragraph(`Here's what you'll continue to have access to:`)}

    <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <ul style="margin: 0; padding-left: 20px; color: #475569;">
        <li style="margin-bottom: 8px;">📊 All your scorecard data and KPIs</li>
        <li style="margin-bottom: 8px;">📞 20 AI call scoring credits per month</li>
        <li style="margin-bottom: 8px;">📚 Full training platform access</li>
        <li style="margin-bottom: 8px;">👥 All your team members and their progress</li>
      </ul>
    </div>

    ${EmailComponents.button('Go to Dashboard', `${SITE_URL}/dashboard`)}

    ${EmailComponents.infoText(`Have questions? Reply to this email – we're here to help!`)}
  `

  const html = buildEmailHtml({
    title: '⏰ 3 Days Left in Your Trial',
    subtitle: `Your subscription continues automatically`,
    bodyContent,
    footerAgencyName: agencyName,
  })

  const text = `Hi ${name},

Your Agency Brain trial ends in 3 days (${endDateFormatted}).

We hope you've been enjoying Agency Brain! Your subscription will automatically continue at $299/month after your trial ends.

Here's what you'll continue to have access to:
• All your scorecard data and KPIs
• 20 AI call scoring credits per month
• Full training platform access
• All your team members and their progress

Go to your dashboard: ${SITE_URL}/dashboard

Have questions? Reply to this email – we're here to help!

— The Agency Brain Team`

  await sendEmail(email, `⏰ 3 days left in your Agency Brain trial`, html, text)
}

async function sendOneDayReminder(email: string, name: string, agencyName: string, trialEnd: Date) {
  const endDateFormatted = trialEnd.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const bodyContent = `
    ${EmailComponents.paragraph(`Hi ${name},`)}

    <div style="background: #eff6ff; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #3b82f6;">
      <strong style="color: #1d4ed8;">📅 Your trial ends tomorrow (${endDateFormatted})</strong>
    </div>

    ${EmailComponents.paragraph(`Just a heads up – your subscription will automatically continue at <strong>$299/month</strong> starting tomorrow. No action needed to keep your access!`)}

    ${EmailComponents.paragraph(`Here's everything you'll continue to enjoy:`)}

    <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <ul style="margin: 0; padding-left: 20px; color: #166534;">
        <li style="margin-bottom: 8px;">✅ Unlimited scorecards & custom KPIs</li>
        <li style="margin-bottom: 8px;">✅ 20 AI call scoring credits per month</li>
        <li style="margin-bottom: 8px;">✅ Full training platform access</li>
        <li style="margin-bottom: 8px;">✅ All your team data preserved</li>
      </ul>
    </div>

    ${EmailComponents.button('Go to Dashboard', `${SITE_URL}/dashboard`)}

    ${EmailComponents.infoText(`Questions? Reply to this email – we're here to help!`)}
  `

  const html = buildEmailHtml({
    title: '📅 Your Trial Ends Tomorrow',
    subtitle: `Your subscription continues automatically`,
    bodyContent,
    footerAgencyName: agencyName,
  })

  const text = `Hi ${name},

Your Agency Brain trial ends tomorrow (${endDateFormatted}).

Just a heads up – your subscription will automatically continue at $299/month starting tomorrow. No action needed to keep your access!

Here's everything you'll continue to enjoy:
• Unlimited scorecards & custom KPIs
• 20 AI call scoring credits per month
• Full training platform access
• All your team data preserved

Go to your dashboard: ${SITE_URL}/dashboard

Questions? Reply to this email – we're here to help!

— The Agency Brain Team`

  await sendEmail(email, `📅 Your Agency Brain trial ends tomorrow`, html, text)
}

