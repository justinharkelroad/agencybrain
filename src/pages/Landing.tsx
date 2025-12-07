import React, { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { AnimatedBackground } from "@/components/AnimatedBackground";

export default function Landing() {
  const { user, loading } = useAuth();
  const previewMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === '1';

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

  if (user && !previewMode) {
    return <Navigate to="/dashboard" />;
  }

  return (
      <main className="relative min-h-svh w-full overflow-hidden bg-background">
        <AnimatedBackground />

        {/* Centered content */}
        <div className="relative z-10 flex min-h-svh items-center justify-center p-6">
          <section className="w-full max-w-2xl text-center text-foreground animate-fade-in">
            {/* SEO: keep a single H1 for the page intent */}
            <h1 className="sr-only">AgencyBrain – Unlock Clarity. Move Faster.</h1>

            {/* Center glass logo card */}
            <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm sm:p-8">
              <img
                src="/lovable-uploads/agencybrain-logo.png"
                alt="AgencyBrain logo"
                className="mx-auto h-20 w-auto sm:h-24"
                height={96}
                onError={(e) => {
                  // Hide broken image; text below remains the entry point
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="mt-6">
                <Button asChild size="lg" className="rounded-full px-8 text-base sm:text-lg bg-white text-black hover:bg-white/90">
                  <Link to="/auth" aria-label="Enter AgencyBrain">
                    ENTER YOUR 🧠 →
                  </Link>
                </Button>
              </div>
            </div>

            <span className="sr-only">Animated abstract background with brand colors.</span>
          </section>
        </div>
      </main>
  );
}
