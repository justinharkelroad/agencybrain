import React, { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Brain, Users } from "lucide-react";

const STAN_LOGO_URL = "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/Agency%20Brain%20Logo%20Stan.png";

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

            <div className="flex flex-col items-center justify-center gap-8">
              <img
                src={STAN_LOGO_URL}
                alt="AgencyBrain logo"
                className="h-24 w-auto sm:h-32"
                height={128}
              />
              
              <div className="flex flex-col gap-4 w-full max-w-sm">
                {/* Brain Portal - for Agency Owners/Admins */}
                <Button asChild variant="flat" size="lg" className="rounded-full px-8 text-base sm:text-lg w-full h-14">
                  <Link to="/auth" aria-label="Enter Brain Portal" className="flex items-center justify-center gap-3">
                    <Brain className="h-5 w-5" />
                    <div className="flex flex-col items-start leading-tight">
                      <span className="font-semibold">Brain Portal</span>
                      <span className="text-xs opacity-80">For Agency Owners</span>
                    </div>
                  </Link>
                </Button>
                
                {/* Staff Portal - for Team Members */}
                <Button asChild variant="outline" size="lg" className="rounded-full px-8 text-base sm:text-lg w-full h-14 border-2">
                  <Link to="/staff/login" aria-label="Enter Staff Portal" className="flex items-center justify-center gap-3">
                    <Users className="h-5 w-5" />
                    <div className="flex flex-col items-start leading-tight">
                      <span className="font-semibold">Staff Portal</span>
                      <span className="text-xs opacity-80">For Team Members</span>
                    </div>
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
