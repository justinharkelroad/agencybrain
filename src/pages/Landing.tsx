import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Brain, Users } from "lucide-react";
import lightModeLogo from "@/assets/agencybrain-logo-light.png";

const DARK_MODE_LOGO = "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/Agency%20Brain%20Logo%20Stan.png";

export default function Landing() {
  const { user, loading } = useAuth();
  const previewMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === '1';

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

      <div className="relative z-10 flex min-h-svh flex-col items-center justify-center p-4 sm:p-6">
        <section className="w-full max-w-4xl text-center text-foreground animate-fade-in">
          <h1 className="sr-only">AgencyBrain – Unlock Clarity. Move Faster.</h1>

          {/* Logo */}
          <div className="flex justify-center mb-10 sm:mb-14">
            <div className="relative animate-float">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl animate-glow-pulse" />
              <img 
                src={lightModeLogo} 
                alt="AgencyBrain - powered by Standard Playbook" 
                className="relative w-48 sm:w-64 md:w-80 h-auto drop-shadow-2xl dark:hidden"
              />
              <img 
                src={DARK_MODE_LOGO} 
                alt="AgencyBrain - powered by Standard Playbook" 
                className="relative w-48 sm:w-64 md:w-80 h-auto drop-shadow-2xl hidden dark:block"
              />
            </div>
          </div>

          {/* Portal Buttons */}
          <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
            <Button asChild variant="flat" size="lg" className="rounded-full px-8 text-base sm:text-lg w-full h-14">
              <Link to="/auth" aria-label="Enter Brain Portal" className="flex items-center justify-center gap-3">
                <Brain className="h-5 w-5" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="font-semibold">Brain Portal</span>
                  <span className="text-xs opacity-80">For Agency Owners</span>
                </div>
              </Link>
            </Button>
            
            <Button asChild variant="outline" size="lg" className="rounded-full px-8 text-base sm:text-lg w-full h-14 border-2">
              <Link to="/staff/login" aria-label="Enter Staff Portal" className="flex items-center justify-center gap-3">
                <Users className="h-5 w-5" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="font-semibold">Staff Portal</span>
                  <span className="text-xs opacity-80">For Team Members</span>
                </div>
              </Link>
            </Button>

            {/* How do I access AgencyBrain? */}
            <a
              href="https://standardplaybook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-3/4 mx-auto mt-2"
            >
              <Button variant="ghost" className="w-full text-sm py-4 text-muted-foreground">
                How do I access Standard & AgencyBrain?
              </Button>
            </a>
          </div>

          <span className="sr-only">Animated abstract background with brand colors.</span>
        </section>
      </div>
    </main>
  );
}
