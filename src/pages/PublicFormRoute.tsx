import "@/lib/custom-elements-guard"; // MUST be first - prevent custom element conflicts
import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import PublicFormSubmission from './PublicFormSubmission';
import { FormNotFoundView } from '@/components/ErrorViews';

/**
 * Route handler for public form URLs: /f/{agencySlug}/{formSlug}?t={token}
 * Validates URL structure and renders appropriate views
 */
export default function PublicFormRoute() {
  const { agencySlug, formSlug } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');

  // Track page view for analytics (admin only)
  useEffect(() => {
    if (agencySlug && formSlug && token) {
      // Only log for admin diagnostics
      if (import.meta.env.DEV || (import.meta.env.VITE_SHOW_DIAGNOSTICS === 'true')) {
        console.log(`Form accessed: ${agencySlug}/${formSlug} with token: ${token.substring(0, 8)}...`);
      }
    }
  }, [agencySlug, formSlug, token]);

  // Validate required parameters
  if (!agencySlug || !formSlug || !token) {
    return <FormNotFoundView />;
  }

  // Validate slug formats (lowercase, alphanumeric, hyphens only)
  if (!/^[a-z0-9-]+$/.test(agencySlug) || !/^[a-z0-9-]+$/.test(formSlug)) {
    return <FormNotFoundView />;
  }

  // Validate token format (basic validation)
  if (token.length < 8 || !/^[a-zA-Z0-9-]+$/.test(token)) {
    return <FormNotFoundView />;
  }

  return <PublicFormSubmission />;
}