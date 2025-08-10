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
          src="https://drive.google.com/uc?export=download&id=1VqVkz6e2pr803viXWZGUVsYSK0TuREXw"
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
        <section className="text-center text-foreground animate-fade-in">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            AgencyBrain
          </h1>
          <p className="mt-4 text-base text-foreground/90 sm:text-lg lg:text-xl">
            Unlock Clarity. Move Faster.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" variant="secondary" className="rounded-full">
              <Link to="/auth" aria-label="Enter AgencyBrain">
                Enter
              </Link>
            </Button>
          </div>
          <span className="sr-only">Background video is muted and loops.</span>
        </section>
      </div>
    </main>
  );
}
