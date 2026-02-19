

## Set Custom OG Share Image for the Six-Week Challenge Page

### The Problem

When you share the `/six-week-challenge` URL via iMessage or social media, crawlers (iMessage, Facebook, Twitter) only read the raw HTML served by the server -- they do NOT execute JavaScript. Since this is a single-page React app, every route serves the same `index.html` with the generic "AGENCY BRAIN" OG image. Dynamically updating meta tags in React has no effect on link previews.

### The Solution

Create a lightweight Supabase Edge Function that acts as a **shareable link proxy**. It detects social media crawlers and serves them a minimal HTML page with the correct OG meta tags and your uploaded image. Real human visitors get instantly redirected to the actual `/six-week-challenge` page.

### Steps

1. **Upload the image to Supabase Storage** -- Copy the uploaded `CORE_4.png` into a public Supabase storage bucket so it has a permanent, publicly accessible URL for crawlers to fetch.

2. **Create an edge function `challenge-og-redirect`** -- This function will:
   - Check the `User-Agent` header for known social crawlers (iMessage/Facebook/Twitter/LinkedIn/Slack bots)
   - If it is a crawler: return a minimal HTML page containing the proper `og:title`, `og:description`, `og:image`, and `twitter:image` meta tags pointing to the uploaded image
   - If it is a real browser: return an instant `<meta http-equiv="refresh">` redirect (plus a JavaScript redirect fallback) to the real `/six-week-challenge` page on the published site

3. **Use the edge function URL as the share link** -- The shareable URL becomes:
   `https://agencybrain.lovable.app/functions/v1/challenge-og-redirect`
   When pasted into iMessage or social media, the crawler sees the custom image and title. When a person taps the link, they land on the real challenge landing page instantly.

### Technical Details

**Edge function (`supabase/functions/challenge-og-redirect/index.ts`):**

```text
Request comes in
    |
    v
Is User-Agent a social crawler?
    |               |
   YES             NO
    |               |
    v               v
Serve HTML with    Redirect to
OG meta tags +     /six-week-challenge
challenge image    via meta refresh
```

- Crawler detection: match against known bot user-agent strings (facebookexternalhit, Twitterbot, LinkedInBot, Slackbot, WhatsApp, iMessage/Applebot)
- The OG tags will include:
  - `og:title`: "Standard Producer Challenge -- 6-Week Training"
  - `og:description`: Compelling description of the challenge
  - `og:image`: Public URL of the uploaded CORE_4.png from Supabase storage
  - `twitter:card`: "summary_large_image"
- Image dimensions: The uploaded image is high-resolution which is ideal for `summary_large_image` card type

**Image storage:** The image will be uploaded to the existing `chatbot-assets` public bucket (or a similar public bucket) so it has a stable URL that crawlers can fetch without authentication.

