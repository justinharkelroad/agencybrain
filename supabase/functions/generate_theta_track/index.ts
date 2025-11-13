import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ELEVEN_API_KEY = Deno.env.get('ELEVEN_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, voiceId, affirmations } = await req.json();

    if (!ELEVEN_API_KEY) {
      throw new Error('ELEVEN_API_KEY not configured');
    }

    if (!sessionId || !voiceId || !affirmations) {
      throw new Error('Missing required parameters');
    }

    // Create supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create track record
    const { data: track, error: insertError } = await supabase
      .from('theta_tracks')
      .insert({
        session_id: sessionId,
        voice_id: voiceId,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating track record:', insertError);
      throw insertError;
    }

    console.log('Track created:', track.id);

    // Start background task for audio generation
    const generateAudio = async () => {
      try {
        // Update status to generating
        await supabase
          .from('theta_tracks')
          .update({ status: 'generating' })
          .eq('id', track.id);

        console.log('Starting audio generation for track:', track.id);

        // Flatten affirmations into array
        const allAffirmations: string[] = [];
        Object.values(affirmations).forEach((categoryAffirmations: any) => {
          if (Array.isArray(categoryAffirmations)) {
            allAffirmations.push(...categoryAffirmations);
          }
        });

        console.log(`Processing ${allAffirmations.length} affirmations`);

        // Generate narration for all affirmations
        const audioSegments: string[] = [];
        
        for (let i = 0; i < allAffirmations.length; i++) {
          const affirmation = allAffirmations[i];
          console.log(`Generating audio for affirmation ${i + 1}/${allAffirmations.length}`);
          
          const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
              method: 'POST',
              headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': ELEVEN_API_KEY,
              },
              body: JSON.stringify({
                text: affirmation,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                  stability: 0.6,
                  similarity_boost: 0.8,
                  style: 0.2,
                  use_speaker_boost: true
                }
              }),
            }
          );

          if (!response.ok) {
            throw new Error(`ElevenLabs error: ${response.status}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          audioSegments.push(base64Audio);

          // Small delay to avoid rate limits
          if (i < allAffirmations.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        console.log('All audio segments generated, creating 21-minute track');

        // Calculate spacing: 21 minutes = 1260 seconds
        // 20 affirmations = ~63 seconds between each
        const totalDuration = 1260; // 21 minutes in seconds
        const silenceDuration = Math.floor(totalDuration / allAffirmations.length);
        
        console.log(`Spacing affirmations: ${silenceDuration}s between each`);

        // Generate silence buffer (empty MP3 frame for spacing)
        // This is a minimal MP3 silence frame that can be repeated
        const createSilenceFrame = (durationSeconds: number): string => {
          // MP3 silence frame (base64 encoded minimal silence)
          const silenceFrame = "//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD/////////////////////////////////////////////8AAAAATGF2YzU4LjM1AAAAAAAAAAAAAAAAJAAAAAAAAAAABIQnCwWnAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
          return silenceFrame.repeat(Math.ceil(durationSeconds / 0.026)); // ~26ms per frame
        };

        // Build final track with spaced affirmations
        let finalTrack = '';
        for (let i = 0; i < audioSegments.length; i++) {
          finalTrack += audioSegments[i];
          if (i < audioSegments.length - 1) {
            finalTrack += createSilenceFrame(silenceDuration);
          }
        }

        console.log('Final 21-minute track created with spaced affirmations');

        // Upload to storage
        const fileName = `${track.id}.mp3`;
        const { error: uploadError } = await supabase
          .storage
          .from('theta-tracks')
          .upload(fileName, 
            Uint8Array.from(atob(finalTrack), c => c.charCodeAt(0)), 
            {
              contentType: 'audio/mpeg',
              upsert: true
            }
          );

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase
          .storage
          .from('theta-tracks')
          .getPublicUrl(fileName);

        console.log('Track uploaded successfully:', publicUrl);

        // Update track record with completion
        await supabase
          .from('theta_tracks')
          .update({
            status: 'completed',
            audio_url: publicUrl,
            completed_at: new Date().toISOString()
          })
          .eq('id', track.id);

        console.log('Track generation completed:', track.id);

      } catch (error) {
        console.error('Background task error:', error);
        
        // Update track with error
        await supabase
          .from('theta_tracks')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', track.id);
      }
    };

    // Start background task without awaiting
    EdgeRuntime.waitUntil(generateAudio());

    // Return immediate response with track ID
    return new Response(
      JSON.stringify({ 
        trackId: track.id,
        status: 'pending',
        message: 'Track generation started'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-theta-track function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
