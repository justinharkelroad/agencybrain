/**
 * Forces cleanup of any stuck Radix UI interaction locks.
 * Call this on route changes to ensure the page remains interactive.
 */
export function cleanupRadixLocks(): void {
  // Reset body pointer-events (Radix sets this during modal open)
  if (document.body.style.pointerEvents === 'none') {
    document.body.style.pointerEvents = '';
  }
  
  // Reset body overflow (Radix scroll lock)
  if (document.body.style.overflow === 'hidden') {
    document.body.style.overflow = '';
  }
  
  // Remove scroll lock attribute
  document.body.removeAttribute('data-scroll-locked');
  
  // Remove inert from root (accessibility lock)
  const root = document.getElementById('root');
  if (root?.hasAttribute('inert')) {
    root.removeAttribute('inert');
  }
  
  // Remove aria-hidden from root
  if (root?.getAttribute('aria-hidden') === 'true') {
    root.removeAttribute('aria-hidden');
  }
}
