import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import jsPDF from 'https://esm.sh/jspdf@2.5.2';

// Extended CORS headers to include x-staff-session
const extendedCorsHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: extendedCorsHeaders });
  }

  try {
    const { token, messages, gradingData } = await req.json();

    if (!messages || !gradingData) {
      return new Response(
        JSON.stringify({ error: 'messages and gradingData are required' }),
        { status: 400, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let staffName: string;
    let staffEmail: string;
    let agencyId: string;
    let createdBy: string;
    let tokenId: string | null = null;

    // Check for staff session header first
    const staffSessionToken = req.headers.get('x-staff-session');
    
    if (staffSessionToken) {
      // STAFF SESSION FLOW (for staff portal users)
      console.log('Validating staff session token for saving...');
      
      const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from('staff_sessions')
        .select(`
          *,
          staff_users!inner (
            id,
            username,
            display_name,
            agency_id,
            email,
            is_active,
            team_member_id
          )
        `)
        .eq('session_token', staffSessionToken)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (sessionError || !sessionData) {
        console.log('Invalid staff session token for saving:', sessionError?.message);
        return new Response(
          JSON.stringify({ error: 'Invalid staff session' }),
          { status: 401, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!sessionData.staff_users?.is_active) {
        return new Response(
          JSON.stringify({ error: 'Staff account is inactive' }),
          { status: 403, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      staffName = sessionData.staff_users.display_name || sessionData.staff_users.username;
      staffEmail = sessionData.staff_users.email || 'unknown@email.com';
      agencyId = sessionData.staff_users.agency_id;
      createdBy = sessionData.staff_users.id;
      
      console.log('Staff session authenticated for saving:', staffName, 'Agency:', agencyId);
    } else if (token) {
      // TOKEN-BASED FLOW (existing flow for staff links)
      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from('roleplay_access_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (tokenError || !tokenData) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 403, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (tokenData.session_completed) {
        return new Response(
          JSON.stringify({ error: 'Session already saved for this token' }),
          { status: 409, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Token expired' }),
          { status: 403, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (tokenData.invalidated) {
        return new Response(
          JSON.stringify({ error: 'Token has been revoked' }),
          { status: 403, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!tokenData.staff_name || !tokenData.staff_email) {
        return new Response(
          JSON.stringify({ error: 'Staff identity not submitted' }),
          { status: 403, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      staffName = tokenData.staff_name;
      staffEmail = tokenData.staff_email;
      agencyId = tokenData.agency_id;
      createdBy = tokenData.created_by;
      tokenId = tokenData.id;
    } else {
      // AUTH-BASED FLOW (for logged-in users)
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization required (no token, staff session, or auth header)' }),
          { status: 401, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create user client to get authenticated user
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        console.error('Auth error:', userError);
        return new Response(
          JSON.stringify({ error: 'Invalid authentication' }),
          { status: 401, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's profile to find agency_id
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.agency_id) {
        console.error('Profile error:', profileError);
        return new Response(
          JSON.stringify({ error: 'User has no agency associated' }),
          { status: 400, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      staffName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Agency Owner';
      staffEmail = user.email || 'unknown@email.com';
      agencyId = profile.agency_id;
      createdBy = user.id;
    }

    console.log('Generating PDF for session, agency:', agencyId);

    // Generate PDF server-side
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(59, 130, 246);
    doc.text('Sales Roleplay Performance Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Staff Info
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Staff: ${staffName}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Email: ${staffEmail}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPosition);
    yPosition += 15;

    // Overall Score
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Overall Performance', margin, yPosition);
    yPosition += 8;
    doc.setFontSize(14);
    const scoreColor = gradingData.overall_score === 'Excellent' ? [34, 197, 94] :
                       gradingData.overall_score === 'Good' ? [59, 130, 246] :
                       gradingData.overall_score === 'Needs Improvement' ? [234, 179, 8] :
                       [239, 68, 68];
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.text(gradingData.overall_score, margin, yPosition);
    yPosition += 15;

    // Grading Sections
    const sections = [
      { key: 'rapport', title: 'Rapport Building' },
      { key: 'information_verification', title: 'Information Verification' },
      { key: 'coverage_conversation', title: 'Coverage Conversation' },
      { key: 'lever_pulls', title: 'Lever Pulls & Pricing Strategy' },
      { key: 'wrap_up', title: 'Wrap-Up & Closing' }
    ];

    for (const section of sections) {
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = margin;
      }

      const sectionData = gradingData[section.key];
      if (!sectionData) continue;

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(section.title, margin, yPosition);
      yPosition += 8;

      // Add summary if available
      if (sectionData.summary) {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const summaryLines = doc.splitTextToSize(sectionData.summary, pageWidth - margin * 2 - 5);
        doc.text(summaryLines, margin + 5, yPosition);
        yPosition += summaryLines.length * 4 + 3;
      }

      doc.setFontSize(10);

      if (sectionData.strengths && sectionData.strengths.length > 0) {
        doc.setTextColor(34, 197, 94);
        doc.text('Strengths:', margin + 5, yPosition);
        yPosition += 6;
        doc.setTextColor(60, 60, 60);
        sectionData.strengths.forEach((strength: string) => {
          const lines = doc.splitTextToSize(`• ${strength}`, pageWidth - margin * 2 - 10);
          doc.text(lines, margin + 10, yPosition);
          yPosition += lines.length * 5;
        });
        yPosition += 3;
      }

      if (sectionData.improvements && sectionData.improvements.length > 0) {
        doc.setTextColor(239, 68, 68);
        doc.text('Areas for Improvement:', margin + 5, yPosition);
        yPosition += 6;
        doc.setTextColor(60, 60, 60);
        sectionData.improvements.forEach((improvement: string) => {
          const lines = doc.splitTextToSize(`• ${improvement}`, pageWidth - margin * 2 - 10);
          doc.text(lines, margin + 10, yPosition);
          yPosition += lines.length * 5;
        });
        yPosition += 3;
      }

      yPosition += 5;
    }

    // Convert PDF to buffer
    const pdfBuffer = doc.output('arraybuffer');
    const pdfBlob = new Uint8Array(pdfBuffer);

    // Upload PDF to storage - use unique ID for auth-based sessions
    const sessionUuid = crypto.randomUUID();
    const fileName = `${agencyId}/${tokenId || sessionUuid}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('roleplay-pdfs')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('PDF upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to save PDF', details: uploadError.message }),
        { status: 500, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('PDF uploaded successfully:', fileName);

    // Insert session record
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('roleplay_sessions')
      .insert({
        token_id: tokenId, // null for auth-based sessions
        agency_id: agencyId,
        staff_name: staffName,
        staff_email: staffEmail,
        created_by: createdBy,
        conversation_transcript: messages,
        grading_data: gradingData,
        overall_score: gradingData.overall_score,
        pdf_file_path: fileName,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Session insert error:', sessionError);
      // Try to clean up uploaded PDF
      await supabaseAdmin.storage.from('roleplay-pdfs').remove([fileName]);
      
      return new Response(
        JSON.stringify({ error: 'Failed to save session', details: sessionError.message }),
        { status: 500, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update token as completed (only for token-based flow)
    if (tokenId) {
      await supabaseAdmin
        .from('roleplay_access_tokens')
        .update({ session_completed: true })
        .eq('id', tokenId);
    }

    console.log('Session saved successfully:', session.id);

    // Get public URL for PDF
    const { data: urlData } = supabaseAdmin.storage
      .from('roleplay-pdfs')
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: session.id,
        pdfUrl: urlData.publicUrl
      }),
      { status: 200, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in save-roleplay-session:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
