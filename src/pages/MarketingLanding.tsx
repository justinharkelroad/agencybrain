import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { HeroSection } from '@/components/marketing/HeroSection';
import { BentoFeatureGrid } from '@/components/marketing/BentoFeatureGrid';
import { FeatureShowcase } from '@/components/marketing/FeatureShowcase';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { PricingSection } from '@/components/marketing/PricingSection';
import { FinalCTA } from '@/components/marketing/FinalCTA';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export default function MarketingLanding() {
  const { user, loading } = useAuth();
  const previewMode = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('preview') === '1';

  // SEO setup
  useEffect(() => {
    const title = 'AgencyBrain - AI-Powered Insurance Agency Management Platform';
    const description =
      'Transform your insurance agency with AI call scoring, real-time scorecards, and proven training systems. Start your 7-day free trial today.';

    document.title = title;

    const ensureMeta = (name: string, content: string) => {
      let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    const ensureOgMeta = (property: string, content: string) => {
      let tag = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    ensureMeta('description', description);
    ensureMeta('keywords', 'insurance agency management, call scoring, AI sales training, scorecard, team performance');

    ensureOgMeta('og:title', title);
    ensureOgMeta('og:description', description);
    ensureOgMeta('og:type', 'website');

    // Canonical URL
    const href = window.location.origin + '/marketing';
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }, []);

  // Show loading state
  if (loading) {
    return (
      <main className="min-h-svh w-full bg-marketing-bg marketing-dark" aria-busy>
        <span className="sr-only">Loading...</span>
      </main>
    );
  }

  // Redirect authenticated users to dashboard (unless in preview mode)
  if (user && !previewMode) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="min-h-svh w-full bg-marketing-bg marketing-dark">
      {/* Smooth scroll for anchor links */}
      <style>{`
        html {
          scroll-behavior: smooth;
        }
      `}</style>

      <MarketingHeader />
      <HeroSection />
      <BentoFeatureGrid />
      <FeatureShowcase />
      <HowItWorks />
      <PricingSection />
      <FinalCTA />
      <MarketingFooter />
    </main>
  );
}
