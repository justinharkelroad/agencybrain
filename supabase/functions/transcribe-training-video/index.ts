import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// --- URL Parsing (mirrors VideoEmbed.tsx) ---

type Platform = 'youtube' | 'unknown';

function detectPlatform(url: string): Platform {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  return 'unknown';
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

// --- HTML entity decoding for YouTube XML ---

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/\n/g, ' ');
}

// --- Transcript cleanup: raw caption segments → readable paragraphs ---

function cleanTranscript(rawText: string): string {
  // Normalize whitespace
  const text = rawText.replace(/\s+/g, ' ').trim();

  // Try splitting into sentences (works when punctuation exists)
  const sentences = text.split(/(?<=[.!?])\s+/);

  // If punctuation-based splitting produced real paragraphs, use it
  if (sentences.length >= 4) {
    const paragraphs: string[] = [];
    let current: string[] = [];
    for (const sentence of sentences) {
      current.push(sentence);
      if (current.length >= 5) {
        paragraphs.push(current.join(' '));
        current = [];
      }
    }
    if (current.length > 0) {
      paragraphs.push(current.join(' '));
    }
    return paragraphs.join('\n\n');
  }

  // Fallback for auto-generated captions with little/no punctuation:
  // split by word count (~80 words per paragraph)
  const words = text.split(' ');
  const paragraphs: string[] = [];
  for (let i = 0; i < words.length; i += 80) {
    paragraphs.push(words.slice(i, i + 80).join(' '));
  }
  return paragraphs.join('\n\n');
}

// --- YouTube transcript fetch via InnerTube API ---
// The HTML-scraping approach fails on Deno Deploy because YouTube serves
// different page content to data-center IPs. The InnerTube API is a proper
// JSON endpoint that works reliably server-side.

const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'; // Public YouTube web client key
const INNERTUBE_CLIENT = {
  clientName: 'WEB',
  clientVersion: '2.20240313.05.00',
  hl: 'en',
};

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  // Step 1: Get video player response via InnerTube API
  const playerRes = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: INNERTUBE_CLIENT },
        videoId,
      }),
    }
  );

  if (!playerRes.ok) {
    throw new Error('Could not access YouTube video. Make sure the video is publicly accessible.');
  }

  const playerData = await playerRes.json();

  // Check for playability issues
  const status = playerData?.playabilityStatus?.status;
  if (status === 'LOGIN_REQUIRED' || status === 'UNPLAYABLE') {
    throw new Error('Could not access YouTube video. Make sure the video is publicly accessible.');
  }

  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) {
    throw new Error('No transcript available for this video. You can paste one manually.');
  }

  // Prefer English, fall back to first available track
  const track =
    tracks.find((t: any) => t.languageCode === 'en') ||
    tracks.find((t: any) => t.languageCode?.startsWith('en')) ||
    tracks[0];

  if (!track?.baseUrl) {
    throw new Error('No transcript available for this video. You can paste one manually.');
  }

  // Step 2: Fetch the transcript XML from the caption track URL
  const transcriptRes = await fetch(track.baseUrl);

  if (!transcriptRes.ok) {
    throw new Error('Failed to fetch video transcript. Try again later.');
  }

  const xml = await transcriptRes.text();

  // Step 3: Parse segments from XML
  const segments: string[] = [];
  RE_XML_TRANSCRIPT.lastIndex = 0;
  let match;
  while ((match = RE_XML_TRANSCRIPT.exec(xml)) !== null) {
    segments.push(decodeHtmlEntities(match[3]));
  }

  if (segments.length === 0) {
    throw new Error('No transcript available for this video. You can paste one manually.');
  }

  return cleanTranscript(segments.join(' '));
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: same pattern as generate-training-content ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { video_url, agency_id } = await req.json();

    if (!video_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: video_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    // If not admin, agency_id is required and flag must be enabled
    if (!isAdmin) {
      if (!agency_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required field: agency_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: agency } = await supabase
        .from('agencies')
        .select('ai_training_enabled')
        .eq('id', agency_id)
        .single();

      if (!agency?.ai_training_enabled) {
        return new Response(
          JSON.stringify({ error: 'AI training not enabled for this agency' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // --- Detect platform and extract video ID ---
    const platform = detectPlatform(video_url);

    let videoId: string | null = null;
    let transcript: string;

    switch (platform) {
      case 'youtube': {
        videoId = extractYouTubeId(video_url);
        if (!videoId) {
          return new Response(
            JSON.stringify({ error: 'Could not parse YouTube video ID from URL' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        try {
          transcript = await fetchYouTubeTranscript(videoId);
        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to transcribe YouTube video' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;
      }

      default:
        return new Response(
          JSON.stringify({
            error: 'Auto-transcription is only available for YouTube videos. For other platforms, paste a transcript or summary into the content field.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ transcript, platform, video_id: videoId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('transcribe-training-video error:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
