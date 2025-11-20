// Generate a simple device fingerprint for session tracking
export function generateDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.width + 'x' + screen.height,
    screen.colorDepth,
  ];
  
  // Simple hash function
  const hash = components.join('|').split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  return `fp_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
}
