import React, { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export default function Landing() {
  const { user, loading } = useAuth();

  // Basic SEO setup for this page
  useEffect(() => {
    const title = "AgencyBrain – Unlock Clarity. Move Faster.";
    const description = "AgencyBrain: Unlock clarity and move faster with structured reporting and AI analysis.";
    document.title = title;

    const ensureMeta = (name: string, content: string) => {
      let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    ensureMeta("description", description);

    // Canonical
    const href = window.location.origin + "/";
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", href);
  }, []);

  if (loading) {
    return (
      <main className="min-h-svh w-full bg-background" aria-busy>
        <span className="sr-only">Loading…</span>
      </main>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background">
      {/* Desktop video (hidden on mobile); respect reduced motion */}
      <video
        className="absolute inset-0 hidden h-full w-full object-cover sm:block motion-reduce:hidden"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/assets/hero-poster-1920.jpg"
        aria-label="Background intro video, muted and looping"
      >
        <source
          src="https://drive.google.com/uc?export=download&id=1guArSd3uWLEIp9VbU5lfZk1pcyi3c3JB"
          type="video/mp4"
        />
      </video>

      {/* Desktop poster fallback for reduced-motion users */}
      <picture className="absolute inset-0 hidden sm:block motion-reduce:block">
        <source srcSet="/assets/hero-poster-1920.webp" type="image/webp" />
        <img
          src="/assets/hero-poster-1920.jpg"
          alt="AgencyBrain intro"
          className="h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
        />
      </picture>

      {/* Mobile poster fallback */}
      <picture className="absolute inset-0 block sm:hidden">
        <source srcSet="/assets/hero-poster-1920.webp" type="image/webp" />
        <img
          src="/assets/hero-poster-1920.jpg"
          alt="AgencyBrain intro"
          className="h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
        />
      </picture>

      {/* Overlay for contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 to-background/90" />

      {/* Centered content */}
      <div className="relative z-10 flex min-h-svh items-center justify-center p-6">
        <section className="w-full max-w-2xl text-center text-foreground animate-fade-in">
          {/* SEO: keep a single H1 for the page intent */}
          <h1 className="sr-only">AgencyBrain – Unlock Clarity. Move Faster.</h1>

          {/* Center glass logo card */}
          <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-card/60 p-6 shadow-elegant backdrop-blur-sm sm:p-8">
            <img
              src="/lovable-uploads/brand-logo.png"
              alt="AgencyBrain logo"
              className="mx-auto h-16 w-auto sm:h-20"
              height={80}
              onError={(e) => {
                // Hide broken image; text below remains the entry point
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="mt-6">
              <Button asChild size="lg" variant="premium" className="rounded-full px-8 text-base sm:text-lg">
                <Link to="/auth" aria-label="Enter AgencyBrain">
                  ENTER YOUR 🧠 →
                </Link>
              </Button>
            </div>
          </div>

          <span className="sr-only">Background video is muted and loops.</span>
        </section>
      </div>
    </main>
  );
}
