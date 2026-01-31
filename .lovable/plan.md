
## What’s actually broken (root cause)

The PDF viewer is failing before it even tries to render your PDF pages because **PDF.js can’t load its worker script**.

Right now `PdfSlideshow.tsx` sets:

- `pdfjs.GlobalWorkerOptions.workerSrc = //cdnjs.cloudflare.com/.../pdf.worker.min.js`

In this Vite + ESM environment, PDF.js tries to load that worker using a dynamic module import and ends up requesting a URL like:

- `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js?import`

That CDN URL is not serving what PDF.js expects in this context (and/or returns 404 depending on CDN edge/path), so PDF.js falls back to a “fake worker”, and then the whole load fails with:

- “Setting up fake worker failed: Failed to fetch dynamically imported module…”

So the “Failed to load PDF” screen you’re seeing is a symptom; the real issue is the worker configuration.

Important note: you already have working worker configuration elsewhere in your codebase:
- `src/utils/bonusQualifiersParser.ts` uses the correct Vite-friendly approach with `import.meta.url`.

## What I’m going to change (high-confidence fix)

### A) Fix the PDF.js worker setup in `PdfSlideshow.tsx` (main fix)
Update `src/components/PdfSlideshow.tsx` so it **stops using the CDN worker** and instead uses the bundler-resolved worker URL (same proven approach you already use in `bonusQualifiersParser.ts`):

- Set:
  - `pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();`

This makes the worker load from your own app build output (same-origin), which avoids the CDN + `?import` issue entirely.

Also add a small guard so we don’t repeatedly overwrite it on every import in dev:
- Only set it if it’s not already set, or always set to the same local path (either approach is fine; I’ll follow the pattern that matches your project style best).

### B) Improve the error message slightly (optional but useful)
In `PdfSlideshow.tsx`, when load fails, change the error handling to log a clearer message if the failure is worker-related (detect substring “worker” / “fake worker”), so debugging is immediate next time.

### C) Remove the Radix warning about missing description (small quality fix)
Your console shows:
- “Missing `Description` or `aria-describedby={undefined}` for {DialogContent}.”

This is coming from `HelpModal.tsx`.

Fix by adding a `DialogDescription` (short, non-technical) under the title, or explicitly setting `aria-describedby={undefined}` if you truly don’t want descriptions. Best practice is `DialogDescription`.

This won’t fix the PDF load issue, but it’s a real UI/accessibility warning and a “fresh eyes” cleanup.

## Files involved

1) `src/components/PdfSlideshow.tsx`
- Replace CDN workerSrc with bundler-resolved worker URL using `import.meta.url`
- Optional: improved error messaging around worker failures

2) `src/components/HelpModal.tsx`
- Add `DialogDescription` to satisfy Radix and remove warnings

## How we’ll verify (specific checks)

1) Go to `/cancel-audit`
2) Click the help button that includes a PDF
3) Confirm:
   - PDF loads (no “Failed to load PDF”)
   - You can click next/prev slides
   - Browser console no longer shows “Setting up fake worker…” and no 404 for pdf.worker
4) Confirm the Dialog warning is gone:
   - No more “Missing Description or aria-describedby…”

## Why I’m confident this is the correct fix

- Your error logs and screenshot show the worker import is the failure point.
- You already successfully use the correct worker configuration style in `bonusQualifiersParser.ts`.
- The current implementation uses a CDN pattern that is commonly incompatible with modern bundlers’ module-worker expectations (especially when `?import` gets appended).

## Edge cases to keep in mind (so it doesn’t surprise you later)

- If a PDF URL requires auth headers (private bucket), PDF.js fetch can fail due to permissions/CORS. Your current setup uses public URLs, so it should be fine. If you later switch to private PDFs, we’ll need signed URLs or a proxy.
- Very large PDFs may render slowly; that’s normal and we can optimize later (pre-render thumbnails, prefetch next page, etc.).
