import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

// --- YouTube transcript fetch ---

const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  // Step 1: Fetch the YouTube watch page
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
  });

  if (!pageRes.ok) {
    throw new Error('Could not access YouTube video. Make sure the video is publicly accessible.');
  }

  const html = await pageRes.text();

  // Check for rate limiting
  if (html.includes('class="g-recaptcha"')) {
    throw new Error('Rate limited. Try again in a minute.');
  }

  // Step 2: Extract captionTracks from embedded JSON
  const split = html.split('"captions":');
  if (split.length <= 1) {
    throw new Error('No transcript available for this video. You can paste one manually.');
  }

  let captionsJson: string;
  try {
    captionsJson = split[1].split(',"videoDetails')[0].replace(/\\n/g, '');
  } catch {
    throw new Error('No transcript available for this video. You can paste one manually.');
  }

  let captions: any;
  try {
    captions = JSON.parse(captionsJson);
  } catch {
    throw new Error('No transcript available for this video. You can paste one manually.');
  }

  const tracks = captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) {
    throw new Error('No transcript available for this video. You can paste one manually.');
  }

  // Prefer English, fall back to first track
  const track = tracks.find((t: any) => t.languageCode === 'en') || tracks[0];

  // Step 3: Fetch the transcript XML
  const transcriptRes = await fetch(track.baseUrl, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!transcriptRes.ok) {
    throw new Error('Failed to fetch video transcript. Try again later.');
  }

  const xml = await transcriptRes.text();

  // Step 4: Parse segments from XML
  const segments: string[] = [];
  RE_XML_TRANSCRIPT.lastIndex = 0; // Reset — module-scoped /g regex retains state across calls
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

    // Platform-specific transcript fetch — errors returned as 200 + { error }
    // so supabase-js puts them in `data` (not the opaque `error` field from 4xx/5xx).
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
