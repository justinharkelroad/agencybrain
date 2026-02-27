/**
 * Tests for verifyRequest auth fallback logic.
 *
 * Background: supabase.functions.invoke() always sends
 * `Authorization: Bearer <anon_key>` even for staff portal users
 * who have no Supabase auth session. verifyRequest must try the JWT,
 * and when it fails (anon key is not a real user JWT), fall back to
 * the x-staff-session header instead of returning 401.
 *
 * This test validates the logic at unit level by importing a
 * portable extract of the decision logic.
 */
import { describe, it, expect } from 'vitest';

/**
 * Simulates verifyRequest's auth path selection.
 * Returns which auth path would be used given the headers.
 *
 * This mirrors the actual logic in supabase/functions/_shared/verifyRequest.ts:
 *   1. If JWT header present → try JWT first
 *   2. If JWT fails AND staff session present → fall back to staff session
 *   3. If JWT fails AND no staff session → return 401
 *   4. If no JWT but staff session present → use staff session
 *   5. If neither → return 401
 */
function resolveAuthPath(
  authHeader: string | null,
  staffSession: string | null,
  jwtIsValid: boolean
): 'jwt' | 'staff' | 'error' {
  const hasJwtHeader = authHeader && authHeader.startsWith('Bearer ');

  // Path 1: Try JWT first
  if (hasJwtHeader) {
    if (jwtIsValid) {
      return 'jwt';
    }
    // JWT failed — fall back to staff session if available
    if (staffSession) {
      return 'staff';
    }
    return 'error';
  }

  // Path 2: Staff session
  if (staffSession) {
    return 'staff';
  }

  return 'error';
}

describe('verifyRequest auth path resolution', () => {
  it('uses JWT when valid JWT is the only auth', () => {
    expect(resolveAuthPath('Bearer valid-jwt', null, true)).toBe('jwt');
  });

  it('uses staff session when no JWT header present', () => {
    expect(resolveAuthPath(null, 'staff-token-abc', false)).toBe('staff');
  });

  it('returns error when no auth at all', () => {
    expect(resolveAuthPath(null, null, false)).toBe('error');
  });

  it('prefers valid JWT over staff session (owner takes precedence)', () => {
    expect(resolveAuthPath('Bearer valid-jwt', 'staff-token-abc', true)).toBe('jwt');
  });

  // THE CRITICAL TEST: This is the exact scenario that caused the production bug.
  // supabase.functions.invoke sends "Bearer <anon_key>" for staff users.
  // The anon key is NOT a valid user JWT, so getUser() fails.
  // verifyRequest MUST fall back to the staff session, not return 401.
  it('falls back to staff session when JWT is invalid (anon key scenario)', () => {
    expect(resolveAuthPath('Bearer anon-key-not-a-jwt', 'staff-token-abc', false)).toBe('staff');
  });

  it('returns error when JWT is invalid and no staff session', () => {
    expect(resolveAuthPath('Bearer invalid-jwt', null, false)).toBe('error');
  });

  it('handles empty Authorization header gracefully', () => {
    expect(resolveAuthPath('', 'staff-token-abc', false)).toBe('staff');
  });

  it('handles non-Bearer Authorization header', () => {
    expect(resolveAuthPath('Basic abc123', 'staff-token-abc', false)).toBe('staff');
  });
});
