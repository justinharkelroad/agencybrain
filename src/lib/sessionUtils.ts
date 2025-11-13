export function generateSessionId(): string {
  return `theta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getOrCreateSessionId(): string {
  const stored = localStorage.getItem('theta_session_id');
  if (stored) return stored;
  
  const newId = generateSessionId();
  localStorage.setItem('theta_session_id', newId);
  return newId;
}

export function clearSessionId(): void {
  localStorage.removeItem('theta_session_id');
}
