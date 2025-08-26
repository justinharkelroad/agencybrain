import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import PublicFormSubmission from './PublicFormSubmission';
import { FormNotFoundView } from '@/components/ErrorViews';

/**
 * Route handler for public form URLs: /f/{slug}?t={token}
 * Validates URL structure and renders appropriate views
 */
export default function PublicFormRoute() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');

  useEffect(() => {
    // Track page view for analytics
    if (slug && token) {
      console.log(`Form accessed: ${slug} with token: ${token.substring(0, 8)}...`);
    }
  }, [slug, token]);

  // Validate required parameters
  if (!slug || !token) {
    return <FormNotFoundView />;
  }

  // Validate slug format (lowercase, alphanumeric, hyphens only)
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return <FormNotFoundView />;
  }

  // Validate token format (basic validation)
  if (token.length < 8 || !/^[a-zA-Z0-9-]+$/.test(token)) {
    return <FormNotFoundView />;
  }

  return <PublicFormSubmission />;
}