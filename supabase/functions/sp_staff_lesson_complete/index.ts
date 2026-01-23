import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { staff_user_id, lesson_id, quiz_score, quiz_answers, reflections } = await req.json();

    console.log('Processing staff lesson completion:', { staff_user_id, lesson_id });

    // Fetch staff user info with team_member and agency
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select(`
        id,
        display_name,
        email,
        team_member_id,
        agency_id
      `)
      .eq('id', staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.error('Staff user not found:', staffError);
      throw new Error('Staff user not found');
    }

    console.log('Staff user found:', staffUser.display_name);

    // Fetch lesson info
    const { data: lesson, error: lessonError } = await supabase
      .from('sp_lessons')
      .select(`
        id,
        name,
        module:sp_modules(
          name,
          category:sp_categories(name)
        )
      `)
      .eq('id', lesson_id)
      .single();

    if (lessonError) {
      console.error('Lesson not found:', lessonError);
      throw lessonError;
    }

    console.log('Lesson found:', lesson.name);

    // Generate AI summary of reflections
    let aiSummary = null;
    if (openaiApiKey && reflections) {
      try {
        console.log('Generating AI summary...');
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are an insightful coach summarizing a team member's training reflections for their manager. Be warm, encouraging, and concise (2-3 sentences). Highlight their key insight and commitment to action.`,
              },
              {
                role: 'user',
                content: `Summarize these lesson reflections from ${staffUser.display_name}:

Biggest Takeaway: ${reflections.takeaway}

Immediate Action: ${reflections.action}

Expected Result: ${reflections.result}`,
              },
            ],
            max_tokens: 200,
          }),
        });

        const aiData = await openaiResponse.json();
        aiSummary = aiData.choices?.[0]?.message?.content;
        console.log('AI summary generated');
      } catch (aiErr) {
        console.error('AI summary error:', aiErr);
      }
    }

    // Save staff progress
    const { error: progressError } = await supabase
      .from('sp_progress_staff')
      .upsert({
        staff_user_id,
        lesson_id,
        video_watched: true,
        content_viewed: true,
        quiz_completed: true,
        quiz_score,
        quiz_passed: true,
        quiz_answers_json: quiz_answers,
        reflection_takeaway: reflections.takeaway,
        reflection_action: reflections.action,
        reflection_result: reflections.result,
        ai_summary: aiSummary,
        completed_at: new Date().toISOString(),
        completion_email_sent: false,
      }, {
        onConflict: 'staff_user_id,lesson_id',
      });

    if (progressError) {
      console.error('Progress save error:', progressError);
      throw progressError;
    }

    console.log('Progress saved successfully');

    // Get agency info and owner email
    const agencyId = staffUser.agency_id;
    if (agencyId && resendApiKey) {
      console.log('Looking for agency owner for agency:', agencyId);
      
      // Find agency owner (profile with this agency_id)
      const { data: agencyOwners, error: ownerError } = await supabase
        .from('profiles')
        .select('id, agency_id')
        .eq('agency_id', agencyId);

      if (ownerError) {
        console.error('Error finding agency owner:', ownerError);
      }

      // Get the first owner's email from auth.users
      if (agencyOwners && agencyOwners.length > 0) {
        const ownerId = agencyOwners[0].id;
        
        // Get user email from auth
        const { data: { user: authUser }, error: authError } = await supabase.auth.admin.getUserById(ownerId);
        
        if (authError) {
          console.error('Error getting auth user:', authError);
        } else if (authUser?.email) {
          console.log('Sending email to agency owner:', authUser.email);
          
          // Get agency name
          const { data: agency } = await supabase
            .from('agencies')
            .select('name')
            .eq('id', agencyId)
            .single();

          // Send email via Resend
          try {
            const emailHtml = `
              <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #1e283a 0%, #0f172a 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">🎓 Training Completed!</h1>
                </div>
                
                <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
                  <p style="color: #334155; font-size: 16px; margin-top: 0;">
                    Hi there,
                  </p>
                  
                  <p style="color: #334155; font-size: 16px;">
                    <strong>${staffUser.display_name}</strong> just completed the training lesson:
                  </p>
                  
                  <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="color: #64748b; font-size: 14px; margin: 0 0 5px 0;">
                      ${lesson?.module?.[0]?.category?.[0]?.name || 'Standard Playbook'} → ${lesson?.module?.[0]?.name || 'Module'}
                    </p>
                    <h3 style="color: #1e293b; margin: 0; font-size: 18px;">
                      ${lesson?.name}
                    </h3>
                    ${quiz_score !== undefined ? `
                      <p style="color: #64748b; font-size: 14px; margin: 10px 0 0 0;">
                        Quiz Score: <strong>${quiz_score}%</strong>
                      </p>
                    ` : ''}
                  </div>

                  <h4 style="color: #1e293b; font-size: 16px; margin-bottom: 10px;">📝 Their Reflections</h4>
                  
                  <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; margin: 0 0 5px 0;">
                      Biggest Takeaway
                    </p>
                    <p style="color: #334155; font-size: 14px; margin: 0 0 15px 0;">
                      "${reflections.takeaway}"
                    </p>
                    
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; margin: 0 0 5px 0;">
                      Immediate Action
                    </p>
                    <p style="color: #334155; font-size: 14px; margin: 0 0 15px 0;">
                      "${reflections.action}"
                    </p>
                    
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; margin: 0 0 5px 0;">
                      Expected Result
                    </p>
                    <p style="color: #334155; font-size: 14px; margin: 0;">
                      "${reflections.result}"
                    </p>
                  </div>

                  ${aiSummary ? `
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                      <h4 style="color: #166534; font-size: 14px; margin: 0 0 10px 0;">🤖 AI Summary</h4>
                      <p style="color: #166534; font-size: 14px; margin: 0;">
                        ${aiSummary}
                      </p>
                    </div>
                  ` : ''}

                  <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                    Keep up the great leadership!
                  </p>
                  
                  <p style="color: #64748b; font-size: 14px;">
                    – Agency Brain
                  </p>
                </div>
                
                <div style="background: #f1f5f9; padding: 20px; border-radius: 0 0 12px 12px; text-align: center;">
                  <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    Standard Playbook Training Notification
                  </p>
                </div>
              </div>
            `;

            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Agency Brain <info@agencybrain.standardplaybook.com>',
                to: authUser.email,
                subject: `🎓 ${staffUser.display_name} completed "${lesson?.name}"`,
                html: emailHtml,
              }),
            });

            if (emailResponse.ok) {
              console.log('Email sent successfully');
              // Mark email as sent
              await supabase
                .from('sp_progress_staff')
                .update({
                  completion_email_sent: true,
                  completion_email_sent_at: new Date().toISOString(),
                })
                .eq('staff_user_id', staff_user_id)
                .eq('lesson_id', lesson_id);
            } else {
              const errorText = await emailResponse.text();
              console.error('Email send failed:', errorText);
            }
          } catch (emailErr) {
            console.error('Email send error:', emailErr);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, ai_summary: aiSummary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
