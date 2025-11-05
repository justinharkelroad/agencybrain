import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import jsPDF from 'https://esm.sh/jspdf@2.5.2';

serve(async (req) => {
  if (handleOptions(req)) return handleOptions(req);

  try {
    const { token, messages, gradingData } = await req.json();

    if (!token || !messages || !gradingData) {
      return new Response(
        JSON.stringify({ error: 'token, messages, and gradingData are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('roleplay_access_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already saved
    if (tokenData.session_completed) {
      return new Response(
        JSON.stringify({ error: 'Session already saved for this token' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Token expired' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invalidated
    if (tokenData.invalidated) {
      return new Response(
        JSON.stringify({ error: 'Token has been revoked' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if identity submitted
    if (!tokenData.staff_name || !tokenData.staff_email) {
      return new Response(
        JSON.stringify({ error: 'Staff identity not submitted' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating PDF for session:', tokenData.id);

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
    doc.text(`Staff: ${tokenData.staff_name}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Email: ${tokenData.staff_email}`, margin, yPosition);
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
      { key: 'greeting', title: 'Greeting & Introduction' },
      { key: 'needs_discovery', title: 'Needs Discovery' },
      { key: 'product_knowledge', title: 'Product Knowledge' },
      { key: 'objection_handling', title: 'Objection Handling' },
      { key: 'closing', title: 'Closing Technique' }
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

      doc.setFontSize(10);
      doc.text(`Score: ${sectionData.score}/5`, margin + 5, yPosition);
      yPosition += 6;

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

    // Upload PDF to storage
    const fileName = `${tokenData.agency_id}/${tokenData.id}.pdf`;
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('PDF uploaded successfully:', fileName);

    // Insert session record
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('roleplay_sessions')
      .insert({
        token_id: tokenData.id,
        agency_id: tokenData.agency_id,
        staff_name: tokenData.staff_name,
        staff_email: tokenData.staff_email,
        created_by: tokenData.created_by,
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update token as completed
    await supabaseAdmin
      .from('roleplay_access_tokens')
      .update({ session_completed: true })
      .eq('id', tokenData.id);

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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in save-roleplay-session:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
