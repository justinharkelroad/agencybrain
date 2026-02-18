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

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function parseTranscriptXml(xml: string): string[] {
  const segments: string[] = [];
  RE_XML_TRANSCRIPT.lastIndex = 0;
  let match;
  while ((match = RE_XML_TRANSCRIPT.exec(xml)) !== null) {
    segments.push(decodeHtmlEntities(match[3]));
  }
  return segments;
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

async function fetchTranscriptFromTrack(track: any): Promise<string> {
  if (!track?.baseUrl) {
    throw new Error('No transcript URL available.');
  }

  const res = await fetch(track.baseUrl);
  if (!res.ok) {
    throw new Error('Failed to fetch video transcript. Try again later.');
  }

  const xml = await res.text();
  const segments = parseTranscriptXml(xml);

  if (segments.length === 0) {
    throw new Error('No transcript available for this video. You can paste one manually.');
  }

  return cleanTranscript(segments.join(' '));
}

// --- Strategy 1: InnerTube embedded player client ---
// The embedded player client bypasses many restrictions that block the
// standard WEB client on server-side requests (LOGIN_REQUIRED, etc.)

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

// --- Strategy 2: InnerTube standard WEB client ---

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

// --- Strategy 3: HTML page scraping ---
// Fetches the YouTube watch page and extracts caption track URLs directly
// from the embedded JSON. Most reliable for embedding-restricted videos.

async function tryPageScrape(videoId: string): Promise<string | null> {
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!pageRes.ok) {
      console.log(`Page scrape: HTTP ${pageRes.status}`);
      return null;
    }

    const html = await pageRes.text();

    if (html.includes('class="g-recaptcha"')) {
      console.log('Page scrape: hit CAPTCHA');
      return null;
    }

    // Extract captions JSON by splitting on known markers.
    // The ytInitialPlayerResponse regex approach is fragile because non-greedy
    // .+? stops at the first }; inside the JSON. Direct split is more reliable.
    const split = html.split('"captions":');
    if (split.length <= 1) {
      console.log('Page scrape: no "captions" block in HTML');
      return null;
    }

    let captionsObj: any = null;
    try {
      const captionsJson = split[1].split(',"videoDetails')[0].replace(/\\n/g, '');
      captionsObj = JSON.parse(captionsJson);
    } catch (e) {
      console.log('Page scrape: JSON parse error:', e);
      return null;
    }

    // captionsObj is the value of "captions" key — should have playerCaptionsTracklistRenderer
    const tracks = captionsObj?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) {
      console.log('Page scrape: no caption tracks in parsed data');
      return null;
    }

    console.log(`Page scrape: found ${tracks.length} caption track(s)`);
    return await fetchTranscriptFromTrack(pickBestTrack(tracks));
  } catch (e) {
    console.log('Page scrape failed:', e);
    return null;
  }
}

// --- Main transcript fetch: tries all strategies ---

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  // Try strategies in order: page scrape first (most reliable for
  // embedding-restricted videos), then InnerTube API fallbacks
  const transcript =
    await tryPageScrape(videoId) ||
    await tryInnerTubeEmbedded(videoId) ||
    await tryInnerTubeWeb(videoId);

  if (!transcript) {
    throw new Error('No transcript available for this video. You can paste one manually.');
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
