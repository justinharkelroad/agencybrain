import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const PUBLISHED_URL = "https://agencybrain.lovable.app";
const IMAGE_URL = "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/chatbot-assets/CORE_4.png";

const OG_TITLE = "Standard Producer Challenge — 6-Week Training";
const OG_DESCRIPTION = "Transform your sales performance in 6 weeks. Daily lessons, accountability tracking, and proven strategies to become a top-producing insurance agent.";

const CRAWLER_PATTERNS = [
  "facebookexternalhit",
  "Facebot",
  "Twitterbot",
  "LinkedInBot",
  "Slackbot",
  "WhatsApp",
  "Applebot",
  "TelegramBot",
  "Discordbot",
  "Pinterestbot",
  "Googlebot",
  "bingbot",
  "iMessageBot",
];

function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some((p) => ua.includes(p.toLowerCase()));
}

serve(async (req) => {
  const userAgent = req.headers.get("user-agent");

  if (isCrawler(userAgent)) {
    // Serve OG meta tags for crawlers
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${OG_TITLE}</title>
  <meta name="description" content="${OG_DESCRIPTION}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${OG_TITLE}" />
  <meta property="og:description" content="${OG_DESCRIPTION}" />
  <meta property="og:image" content="${IMAGE_URL}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${PUBLISHED_URL}/six-week-challenge" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${OG_TITLE}" />
  <meta name="twitter:description" content="${OG_DESCRIPTION}" />
  <meta name="twitter:image" content="${IMAGE_URL}" />
</head>
<body></body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Real user — redirect to the actual page
  const redirectUrl = `${PUBLISHED_URL}/six-week-challenge`;
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=${redirectUrl}" />
  <script>window.location.replace("${redirectUrl}");</script>
</head>
<body>Redirecting...</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
