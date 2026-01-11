import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const APP_URL = Deno.env.get('SITE_URL') || 'https://app.standardplaybook.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOGO_URL = 'https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/file-uploads/Agency%20Brain%20Logo%20Stan.png';
const EXCHANGE_URL = 'https://app.standardplaybook.com/exchange';

// Helper to build email HTML
function buildEmailHtml(posterName: string, messageContent: string, fileName?: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e283a 0%, #020817 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: right;">
      <img src="${LOGO_URL}" alt="AgencyBrain" style="width: 140px; height: auto;" />
    </div>
    
    <div style="background: #fff; padding: 32px; border-radius: 0 0 12px 12px;">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Head to "The Exchange" tab to see what was just shared by Justin!
      </p>
      
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; margin-bottom: 24px;">
        <p style="color: #1f2937; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">
${messageContent}
        </p>
      </div>
      
      ${fileName ? `
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 20px;">
          📎 Attachment: ${fileName}
        </p>
      ` : ''}
      
      <a href="${EXCHANGE_URL}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px;">
        View in The Exchange
      </a>
      
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0;">
          Your Friend,
        </p>
        <p style="color: #1f2937; font-size: 15px; line-height: 1.6; margin: 8px 0 0 0; font-weight: 600;">
          Justin E Harkelroad
        </p>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.4; margin: 4px 0 0 0;">
          Standard Playbook & AgencyBrain
        </p>
      </div>
    </div>
    
    <div style="text-align: center; padding: 20px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">Agency Brain</p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { post_id, subject, message, audience, include_staff, preview, posterName: previewPosterName, attachmentName: previewAttachmentName } = await req.json();
    
    console.log('Send exchange notification request:', { post_id, audience, include_staff, preview });
    
    // PREVIEW MODE: Return HTML without sending
    if (preview) {
      const htmlContent = buildEmailHtml(
        previewPosterName || 'Justin',
        message || 'Check out this new content in The Exchange.',
        previewAttachmentName
      );
      
      console.log('📧 EMAIL PREVIEW MODE - returning HTML');
      
      return new Response(htmlContent, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    // SEND MODE: Validate and send emails
    if (!post_id) {
      return new Response(
        JSON.stringify({ error: 'post_id is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Fetch post details
    const { data: post, error: postError } = await supabase
      .from('exchange_posts')
      .select('*, user:profiles!user_id(full_name, email)')
      .eq('id', post_id)
      .single();
    
    if (postError || !post) {
      console.error('Post not found:', postError);
      return new Response(
        JSON.stringify({ error: 'Post not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Build recipient query based on audience
    let recipientEmails: string[] = [];
    
    if (audience === 'all' || audience === 'one_on_one' || audience === 'boardroom') {
      let query = supabase
        .from('profiles')
        .select('email, full_name, membership_tier, agency_id')
        .neq('role', 'admin')
        .not('agency_id', 'is', null)
        .not('email', 'is', null);
      
      if (audience === 'one_on_one') {
        query = query.eq('membership_tier', '1:1 Coaching');
      } else if (audience === 'boardroom') {
        query = query.in('membership_tier', ['1:1 Coaching', 'Boardroom']);
      }
      
      const { data: profiles, error: profilesError } = await query;
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }
      recipientEmails = (profiles || []).map(p => p.email).filter(Boolean);
      console.log(`Found ${recipientEmails.length} profiles for audience: ${audience}`);
    }
    
    if (audience === 'call_scoring') {
      // Get agencies with call scoring enabled
      const { data: csAgencies, error: csError } = await supabase
        .from('agency_call_scoring_settings')
        .select('agency_id')
        .eq('enabled', true);
      
      if (csError) {
        console.error('Error fetching call scoring agencies:', csError);
      }
      
      const agencyIds = (csAgencies || []).map(a => a.agency_id).filter(Boolean);
      console.log(`Found ${agencyIds.length} agencies with call scoring enabled`);
      
      if (agencyIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('email')
          .in('agency_id', agencyIds)
          .neq('role', 'admin')
          .not('email', 'is', null);
        
        if (profilesError) {
          console.error('Error fetching call scoring profiles:', profilesError);
        }
        recipientEmails = (profiles || []).map(p => p.email).filter(Boolean);
      }
    }
    
    // Include staff if requested
    if (include_staff) {
      const { data: staffUsers, error: staffError } = await supabase
        .from('staff_users')
        .select('email')
        .not('email', 'is', null);
      
      if (staffError) {
        console.error('Error fetching staff users:', staffError);
      }
      
      const staffEmails = (staffUsers || []).map(s => s.email).filter(Boolean);
      console.log(`Adding ${staffEmails.length} staff emails`);
      recipientEmails = [...new Set([...recipientEmails, ...staffEmails])];
    }
    
    // Handle staff-only audience
    if (audience === 'staff') {
      const { data: staffUsers, error: staffError } = await supabase
        .from('staff_users')
        .select('email')
        .not('email', 'is', null);
      
      if (staffError) {
        console.error('Error fetching staff users for staff audience:', staffError);
      }
      recipientEmails = (staffUsers || []).map(s => s.email).filter(Boolean);
    }
    
    if (recipientEmails.length === 0) {
      console.log('No recipients found for audience:', audience);
      return new Response(
        JSON.stringify({ error: 'No recipients found', sent: 0 }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Remove duplicates
    recipientEmails = [...new Set(recipientEmails)];
    console.log(`Sending to ${recipientEmails.length} unique recipients`);
    
    // Build email HTML
    const posterName = post.user?.full_name || 'Justin';
    const htmlContent = buildEmailHtml(
      posterName,
      message || post.content_text || 'New content has been shared.',
      post.file_name
    );
    
    // Send via Resend (batch send)
    const emailBatch = recipientEmails.map(email => ({
      from: 'Agency Brain <info@agencybrain.standardplaybook.com>',
      to: email,
      subject: subject || 'New post in The Exchange',
      html: htmlContent,
    }));
    
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBatch),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send emails', details: errorText }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const result = await response.json();
    console.log('Resend response:', result);
    
    return new Response(
      JSON.stringify({ success: true, sent: recipientEmails.length }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in send-exchange-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
