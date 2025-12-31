/**
 * Forces cleanup of any stuck Radix UI interaction locks.
 * Call this on route changes to ensure the page remains interactive.
 */
export function cleanupRadixLocks(): void {
  // Don't unlock if a dialog is actually open
  const openDialog = document.querySelector('[role="dialog"][data-state="open"]');
  if (openDialog) {
    return;
  }

  // Reset body pointer-events (check both inline and computed)
  if (
    document.body.style.pointerEvents === 'none' ||
    getComputedStyle(document.body).pointerEvents === 'none'
  ) {
    document.body.style.pointerEvents = '';
  }

  // Also check html element
  if (
    document.documentElement.style.pointerEvents === 'none' ||
    getComputedStyle(document.documentElement).pointerEvents === 'none'
  ) {
    document.documentElement.style.pointerEvents = '';
  }

  // Reset body overflow (Radix scroll lock)
  if (document.body.style.overflow === 'hidden') {
    document.body.style.overflow = '';
  }

  // Remove scroll lock attribute
  document.body.removeAttribute('data-scroll-locked');

  // Remove inert from root and body
  const root = document.getElementById('root');
  if (root?.hasAttribute('inert')) {
    root.removeAttribute('inert');
  }
  if (document.body.hasAttribute('inert')) {
    document.body.removeAttribute('inert');
  }

  // Remove aria-hidden from root and body
  if (root?.getAttribute('aria-hidden') === 'true') {
    root.removeAttribute('aria-hidden');
  }
  if (document.body.getAttribute('aria-hidden') === 'true') {
    document.body.removeAttribute('aria-hidden');
  }
}

/**
 * Checks if the page appears to be locked by Radix UI.
 */
export function isPageLocked(): boolean {
  const openDialog = document.querySelector('[role="dialog"][data-state="open"]');
  if (openDialog) {
    return false; // Not stuck, dialog is legitimately open
  }

  const root = document.getElementById('root');
  const bodyLocked =
    document.body.style.pointerEvents === 'none' ||
    getComputedStyle(document.body).pointerEvents === 'none';
  const htmlLocked =
    document.documentElement.style.pointerEvents === 'none' ||
    getComputedStyle(document.documentElement).pointerEvents === 'none';
  const rootInert = root?.hasAttribute('inert') ?? false;
  const rootHidden = root?.getAttribute('aria-hidden') === 'true';

  return bodyLocked || htmlLocked || rootInert || rootHidden;
}
