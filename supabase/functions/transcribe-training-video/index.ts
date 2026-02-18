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
  const text = rawText.replace(/\s+/g, ' ').trim();

  const sentences = text.split(/(?<=[.!?])\s+/);

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

  const words = text.split(' ');
  const paragraphs: string[] = [];
  for (let i = 0; i < words.length; i += 80) {
    paragraphs.push(words.slice(i, i + 80).join(' '));
  }
  return paragraphs.join('\n\n');
}

// --- YouTube transcript XML parsers ---

// Format 1: Simple <text> elements (older/some tracks)
const RE_SIMPLE_TEXT = /<text start="[^"]*" dur="[^"]*">([^<]*)<\/text>/g;

// Format 2: srv3 format with <p> containing <s> children (ANDROID client)
const RE_P_TAG = /<p[^>]*>([^]*?)<\/p>/g;
const RE_S_TAG = />([^<]+)</g;

function parseTranscriptXml(xml: string): string[] {
  // Try simple <text> format first
  RE_SIMPLE_TEXT.lastIndex = 0;
  const simpleSegments: string[] = [];
  let match;
  while ((match = RE_SIMPLE_TEXT.exec(xml)) !== null) {
    const text = decodeHtmlEntities(match[1]).trim();
    if (text) simpleSegments.push(text);
  }
  if (simpleSegments.length > 0) {
    console.log(`Parsed ${simpleSegments.length} segments (simple format)`);
    return simpleSegments;
  }

  // Try srv3 <p>/<s> format
  RE_P_TAG.lastIndex = 0;
  const srv3Segments: string[] = [];
  while ((match = RE_P_TAG.exec(xml)) !== null) {
    const pContent = match[1];
    // Extract text from within the <p> tag, handling <s> children
    RE_S_TAG.lastIndex = 0;
    const words: string[] = [];
    let sMatch;
    while ((sMatch = RE_S_TAG.exec(pContent)) !== null) {
      const word = decodeHtmlEntities(sMatch[1]).trim();
      if (word) words.push(word);
    }
    if (words.length > 0) {
      srv3Segments.push(words.join(' '));
    }
  }
  if (srv3Segments.length > 0) {
    console.log(`Parsed ${srv3Segments.length} segments (srv3 format)`);
    return srv3Segments;
  }

  // Last resort: strip all XML tags and grab text content
  const stripped = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped.length > 50) {
    console.log(`Parsed via tag-stripping fallback (${stripped.length} chars)`);
    return [stripped];
  }

  return [];
}

function findCaptionTracks(playerData: any): any[] | null {
  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return tracks && tracks.length > 0 ? tracks : null;
}

function pickBestTrack(tracks: any[]): any {
  return (
    tracks.find((t: any) => t.languageCode === 'en') ||
    tracks.find((t: any) => t.languageCode?.startsWith('en')) ||
    tracks[0]
  );
}

async function fetchTranscriptFromTrack(track: any): Promise<string | null> {
  if (!track?.baseUrl) return null;

  const res = await fetch(track.baseUrl);
  if (!res.ok) {
    console.log(`Track fetch: HTTP ${res.status}`);
    return null;
  }

  const xml = await res.text();
  if (!xml || xml.length < 10) {
    console.log(`Track fetch: empty response (${xml.length} bytes)`);
    return null;
  }

  const segments = parseTranscriptXml(xml);
  if (segments.length === 0) {
    console.log('Track fetch: no segments parsed from XML');
    return null;
  }

  return cleanTranscript(segments.join(' '));
}

// --- Strategy 1: InnerTube ANDROID client ---
// The ANDROID client returns OK + caption tracks for videos that WEB and
// WEB_EMBEDDED_PLAYER mark as UNPLAYABLE. Uses its own API key.

async function tryInnerTubeAndroid(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(
      'https://www.youtube.com/youtubei/v1/player?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w&prettyPrint=false',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'ANDROID',
              clientVersion: '19.09.37',
              androidSdkVersion: 30,
              hl: 'en',
            },
          },
          videoId,
        }),
      }
    );

    if (!res.ok) {
      console.log(`InnerTube ANDROID: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const status = data?.playabilityStatus?.status;
    console.log(`InnerTube ANDROID: status=${status}`);

    if (status !== 'OK') return null;

    const tracks = findCaptionTracks(data);
    if (!tracks) {
      console.log('InnerTube ANDROID: no caption tracks');
      return null;
    }

    console.log(`InnerTube ANDROID: found ${tracks.length} track(s), lang=${tracks.map((t: any) => t.languageCode).join(',')}`);
    return await fetchTranscriptFromTrack(pickBestTrack(tracks));
  } catch (e) {
    console.log('InnerTube ANDROID failed:', e);
    return null;
  }
}

// --- Strategy 2: InnerTube WEB_EMBEDDED_PLAYER client ---

async function tryInnerTubeEmbedded(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(
      'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB_EMBEDDED_PLAYER',
              clientVersion: '1.20240313.00.00',
              hl: 'en',
            },
            thirdParty: { embedUrl: 'https://www.google.com' },
          },
          videoId,
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const status = data?.playabilityStatus?.status;
    console.log(`InnerTube embedded: status=${status}`);

    if (status !== 'OK') return null;

    const tracks = findCaptionTracks(data);
    if (!tracks) return null;

    return await fetchTranscriptFromTrack(pickBestTrack(tracks));
  } catch (e) {
    console.log('InnerTube embedded failed:', e);
    return null;
  }
}

// --- Strategy 3: InnerTube standard WEB client ---

async function tryInnerTubeWeb(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(
      'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240313.05.00',
              hl: 'en',
            },
          },
          videoId,
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const status = data?.playabilityStatus?.status;
    console.log(`InnerTube WEB: status=${status}`);

    if (status !== 'OK') return null;

    const tracks = findCaptionTracks(data);
    if (!tracks) return null;

    return await fetchTranscriptFromTrack(pickBestTrack(tracks));
  } catch (e) {
    console.log('InnerTube WEB failed:', e);
    return null;
  }
}

// --- Main transcript fetch: tries all strategies ---

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  // ANDROID client is most reliable — works for embedding-restricted videos
  // where WEB and WEB_EMBEDDED_PLAYER return UNPLAYABLE
  const debugLog: string[] = [];

  const origLog = console.log;
  console.log = (...args: any[]) => {
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    debugLog.push(msg);
    origLog(...args);
  };

  const transcript =
    await tryInnerTubeAndroid(videoId) ||
    await tryInnerTubeEmbedded(videoId) ||
    await tryInnerTubeWeb(videoId);

  console.log = origLog;

  if (!transcript) {
    throw new Error(`No transcript available for this video. Debug: [${debugLog.join(' | ')}]`);
  }

  return transcript;
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
