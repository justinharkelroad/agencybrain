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

// --- Constants ---

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const CONSENT_COOKIES = 'CONSENT=YES+cb.20210328-17-p0.en+FX+634; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AxGgJlbiACGgYIgJnfpwY';

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

const RE_SIMPLE_TEXT = /<text start="[^"]*" dur="[^"]*">([^<]*)<\/text>/g;
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
  if (simpleSegments.length > 0) return simpleSegments;

  // Try srv3 <p>/<s> format
  RE_P_TAG.lastIndex = 0;
  const srv3Segments: string[] = [];
  while ((match = RE_P_TAG.exec(xml)) !== null) {
    const pContent = match[1];
    RE_S_TAG.lastIndex = 0;
    const words: string[] = [];
    let sMatch;
    while ((sMatch = RE_S_TAG.exec(pContent)) !== null) {
      const word = decodeHtmlEntities(sMatch[1]).trim();
      if (word) words.push(word);
    }
    if (words.length > 0) srv3Segments.push(words.join(' '));
  }
  if (srv3Segments.length > 0) return srv3Segments;

  // Last resort: strip all tags
  const stripped = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped.length > 50) return [stripped];

  return [];
}

// --- Caption track helpers ---

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

// --- Cookie extraction from response headers ---

function extractCookies(headers: Headers): string {
  // Deno supports getSetCookie() since 1.34
  const setCookies = (headers as any).getSetCookie?.() || [];
  if (setCookies.length > 0) {
    return setCookies.map((c: string) => c.split(';')[0]).join('; ');
  }
  // Fallback: try raw header (comma-joined in some runtimes)
  const raw = headers.get('set-cookie');
  if (raw) {
    return raw.split(/,\s*(?=[A-Z_]+=)/).map((c: string) => c.split(';')[0]).join('; ');
  }
  return '';
}

// --- Timedtext fetch with cookies ---

async function fetchTimedText(track: any, cookies: string, debugLog: string[]): Promise<string | null> {
  if (!track?.baseUrl) return null;

  const headers: Record<string, string> = {
    'User-Agent': BROWSER_UA,
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (cookies) headers['Cookie'] = cookies;

  const res = await fetch(track.baseUrl, { headers });
  if (!res.ok) {
    debugLog.push(`timedtext: HTTP ${res.status}`);
    return null;
  }

  const xml = await res.text();
  if (!xml || xml.length < 10) {
    debugLog.push(`timedtext: empty (${xml.length}b)`);
    return null;
  }

  const segments = parseTranscriptXml(xml);
  if (segments.length === 0) {
    debugLog.push('timedtext: 0 segments parsed');
    return null;
  }

  debugLog.push(`timedtext: ${segments.length} segments, ${xml.length}b`);
  return cleanTranscript(segments.join(' '));
}

// --- Strategy 1: Watch page with consent cookies ---
// This is what youtube_transcript_api (Python) uses.
// We send consent cookies to bypass GDPR pages, then extract captions from the HTML.

async function tryWatchPage(
  videoId: string,
  debugLog: string[]
): Promise<{ transcript?: string; cookies: string; apiKey?: string; visitorData?: string }> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': CONSENT_COOKIES,
      },
      redirect: 'follow',
    });

    const responseCookies = extractCookies(res.headers);
    const allCookies = responseCookies
      ? `${CONSENT_COOKIES}; ${responseCookies}`
      : CONSENT_COOKIES;

    const html = await res.text();
    debugLog.push(`watchPage: ${html.length} chars, HTTP ${res.status}`);

    // Extract API key from page
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
    const apiKey = apiKeyMatch?.[1];

    // Extract visitorData from page
    const visitorDataMatch = html.match(/"visitorData"\s*:\s*"([^"]+)"/);
    const visitorData = visitorDataMatch?.[1];
    if (visitorData) debugLog.push(`watchPage: got visitorData`);

    // Check for consent page (no video data)
    if (html.includes('consent.youtube.com') || html.includes('consent.google.com')) {
      debugLog.push('watchPage: consent page detected');
      return { cookies: allCookies, apiKey, visitorData };
    }

    // Extract captions from ytInitialPlayerResponse
    const captionsSplit = html.split('"captions":');
    if (captionsSplit.length <= 1) {
      debugLog.push('watchPage: no captions in HTML');
      // Log why for debugging
      if (html.includes('LOGIN_REQUIRED')) debugLog.push('watchPage: LOGIN_REQUIRED');
      if (html.includes('UNPLAYABLE')) debugLog.push('watchPage: UNPLAYABLE');
      if (html.includes('Sign in')) debugLog.push('watchPage: sign-in prompt');
      return { cookies: allCookies, apiKey, visitorData };
    }

    // Parse the captions JSON
    // The split gives us everything after "captions": — we need to find the end
    const afterCaptions = captionsSplit[1];
    // Find the closing boundary: ,"videoDetails" or ,"microformat" or ,"playbackTracking"
    const endMatch = afterCaptions.match(/,"(?:videoDetails|microformat|playbackTracking|attestation)"/);
    if (!endMatch) {
      debugLog.push('watchPage: could not find captions JSON boundary');
      return { cookies: allCookies, apiKey, visitorData };
    }

    const captionsRaw = afterCaptions.substring(0, endMatch.index);
    let captionsJson: any;
    try {
      captionsJson = JSON.parse(captionsRaw);
    } catch {
      debugLog.push(`watchPage: JSON parse failed (${captionsRaw.length} chars)`);
      return { cookies: allCookies, apiKey, visitorData };
    }

    const tracks = captionsJson?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) {
      debugLog.push('watchPage: no caption tracks in parsed JSON');
      return { cookies: allCookies, apiKey, visitorData };
    }

    debugLog.push(`watchPage: found ${tracks.length} track(s)`);
    const track = pickBestTrack(tracks);
    const transcript = await fetchTimedText(track, allCookies, debugLog);

    return { transcript: transcript || undefined, cookies: allCookies, apiKey, visitorData };
  } catch (e) {
    debugLog.push(`watchPage: error ${e}`);
    return { cookies: CONSENT_COOKIES };
  }
}

// --- Strategy 2: get_transcript InnerTube endpoint ---
// Different from the /player endpoint — directly returns transcript text.
// May have different auth requirements.

function encodeGetTranscriptParams(videoId: string): string {
  // Protobuf: field 1 (message) { field 2 (string): videoId }
  const videoIdBytes = new TextEncoder().encode(videoId);

  // Inner message: field 2 (tag=0x12), length, value
  const innerPayload = new Uint8Array([0x12, videoIdBytes.length, ...videoIdBytes]);
  // Outer message: field 1 (tag=0x0a), length, inner
  const outerPayload = new Uint8Array([0x0a, innerPayload.length, ...innerPayload]);

  return btoa(String.fromCharCode(...outerPayload));
}

async function tryGetTranscript(
  videoId: string,
  cookies: string,
  apiKey: string | undefined,
  visitorData: string | undefined,
  debugLog: string[]
): Promise<string | null> {
  try {
    const params = encodeGetTranscriptParams(videoId);
    const key = apiKey || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

    const context: any = {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20241126.01.00',
        hl: 'en',
        gl: 'US',
      },
    };
    if (visitorData) context.client.visitorData = visitorData;

    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/get_transcript?key=${key}&prettyPrint=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': BROWSER_UA,
          'Cookie': cookies,
          'Origin': 'https://www.youtube.com',
          'Referer': `https://www.youtube.com/watch?v=${videoId}`,
          'X-YouTube-Client-Name': '1',
          'X-YouTube-Client-Version': '2.20241126.01.00',
        },
        body: JSON.stringify({ context, params }),
      }
    );

    if (!res.ok) {
      debugLog.push(`getTranscript: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();

    // Check for error
    if (data?.error) {
      debugLog.push(`getTranscript: error ${data.error.code} ${data.error.status}`);
      return null;
    }

    // Navigate to transcript segments
    // Response structure: actions[0].updateEngagementPanelAction.content.transcriptRenderer
    //   .body.transcriptBodyRenderer.cueGroups[].transcriptCueGroupRenderer
    //   .cues[].transcriptCueRenderer.cue.simpleText
    const actions = data?.actions;
    if (!actions || actions.length === 0) {
      debugLog.push(`getTranscript: no actions`);
      return null;
    }

    let cueGroups: any[] | null = null;

    // Try standard path
    const transcriptRenderer =
      actions[0]?.updateEngagementPanelAction?.content?.transcriptRenderer;
    cueGroups =
      transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups || null;

    // Alternative path: direct transcriptSearchPanelRenderer
    if (!cueGroups) {
      for (const action of actions) {
        const panel = action?.updateEngagementPanelAction?.content;
        const body =
          panel?.transcriptRenderer?.body?.transcriptBodyRenderer ||
          panel?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer;
        if (body?.cueGroups) {
          cueGroups = body.cueGroups;
          break;
        }
      }
    }

    if (!cueGroups || cueGroups.length === 0) {
      debugLog.push(`getTranscript: no cueGroups (keys: ${JSON.stringify(Object.keys(data)).substring(0, 100)})`);
      return null;
    }

    // Extract text from each cue
    const segments: string[] = [];
    for (const group of cueGroups) {
      const cues = group.transcriptCueGroupRenderer?.cues;
      if (cues) {
        for (const cue of cues) {
          const text =
            cue.transcriptCueRenderer?.cue?.simpleText ||
            cue.transcriptCueRenderer?.cue?.runs?.map((r: any) => r.text).join('');
          if (text) segments.push(text);
        }
      }
    }

    if (segments.length === 0) {
      debugLog.push('getTranscript: 0 text segments');
      return null;
    }

    debugLog.push(`getTranscript: ${segments.length} segments`);
    return cleanTranscript(segments.join(' '));
  } catch (e) {
    debugLog.push(`getTranscript: error ${e}`);
    return null;
  }
}

// --- Strategy 3: InnerTube player with cookies + visitorData ---
// Now with proper browser headers and session cookies from the watch page.

async function tryInnerTubeWithSession(
  videoId: string,
  cookies: string,
  apiKey: string | undefined,
  visitorData: string | undefined,
  debugLog: string[]
): Promise<string | null> {
  const key = apiKey || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

  // Try multiple client types with session data
  const clients = [
    {
      name: 'WEB',
      clientName: 'WEB',
      clientVersion: '2.20241126.01.00',
      ua: BROWSER_UA,
      xClientName: '1',
    },
    {
      name: 'MWEB',
      clientName: 'MWEB',
      clientVersion: '2.20241126.01.00',
      ua: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      xClientName: '2',
    },
    {
      name: 'TVHTML5_EMBEDDED',
      clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
      clientVersion: '2.0',
      ua: BROWSER_UA,
      xClientName: '85',
    },
  ];

  for (const client of clients) {
    try {
      const context: any = {
        client: {
          clientName: client.clientName,
          clientVersion: client.clientVersion,
          hl: 'en',
          gl: 'US',
        },
      };
      if (visitorData) context.client.visitorData = visitorData;
      if (client.name === 'TVHTML5_EMBEDDED') {
        context.thirdParty = { embedUrl: 'https://www.google.com' };
      }

      const res = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${key}&prettyPrint=false`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': client.ua,
            'Cookie': cookies,
            'Origin': 'https://www.youtube.com',
            'Referer': 'https://www.youtube.com/',
            'X-YouTube-Client-Name': client.xClientName,
            'X-YouTube-Client-Version': client.clientVersion,
          },
          body: JSON.stringify({ context, videoId }),
        }
      );

      if (!res.ok) {
        debugLog.push(`player/${client.name}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const status = data?.playabilityStatus?.status;
      debugLog.push(`player/${client.name}: status=${status}`);

      if (status !== 'OK') continue;

      const tracks = findCaptionTracks(data);
      if (!tracks) {
        debugLog.push(`player/${client.name}: no tracks`);
        continue;
      }

      debugLog.push(`player/${client.name}: ${tracks.length} track(s)`);
      const track = pickBestTrack(tracks);
      const transcript = await fetchTimedText(track, cookies, debugLog);
      if (transcript) return transcript;
    } catch (e) {
      debugLog.push(`player/${client.name}: error ${e}`);
    }
  }

  return null;
}

// --- Strategy 4: Direct timedtext URL (no auth) ---
// Simplest approach — may work for some videos with public captions.

async function tryDirectTimedText(videoId: string, debugLog: string[]): Promise<string | null> {
  const urls = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=srv3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!res.ok) continue;

      const text = await res.text();
      if (!text || text.length < 20) continue;

      const segments = parseTranscriptXml(text);
      if (segments.length > 0) {
        debugLog.push(`directTimedText: ${segments.length} segments`);
        return cleanTranscript(segments.join(' '));
      }
    } catch {
      // continue to next URL
    }
  }

  debugLog.push('directTimedText: all URLs empty');
  return null;
}

// --- Main transcript fetch: tries all strategies in order ---

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  const debugLog: string[] = [];

  // Strategy 1: Watch page with consent cookies
  // Also captures session cookies, API key, and visitorData for subsequent strategies
  const watchResult = await tryWatchPage(videoId, debugLog);
  if (watchResult.transcript) return watchResult.transcript;

  const { cookies, apiKey, visitorData } = watchResult;

  // Strategy 2: get_transcript endpoint (different from player, may have looser auth)
  const t2 = await tryGetTranscript(videoId, cookies, apiKey, visitorData, debugLog);
  if (t2) return t2;

  // Strategy 3: InnerTube player with session cookies + visitorData
  const t3 = await tryInnerTubeWithSession(videoId, cookies, apiKey, visitorData, debugLog);
  if (t3) return t3;

  // Strategy 4: Direct timedtext URL
  const t4 = await tryDirectTimedText(videoId, debugLog);
  if (t4) return t4;

  throw new Error(`No transcript available for this video. Debug: [${debugLog.join(' | ')}]`);
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
