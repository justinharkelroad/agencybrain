import { CancelAuditRecord } from '@/types/cancel-audit';

// Format cents to currency: 249200 -> "$2,492.00"
export function formatCentsToCurrency(cents: number | null): string {
  if (cents === null || cents === undefined) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cents / 100);
}

// Format date for display: "2025-12-27" -> "Dec 27, 2025"
export function formatDate(dateString: string | null): string {
  if (!dateString) return '--';
  const date = new Date(dateString + 'T00:00:00'); // Avoid timezone issues
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Format date short: "2025-12-27" -> "12/27/25"
export function formatDateShort(dateString: string | null): string {
  if (!dateString) return '--';
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit'
  });
}

// Get urgency level for a record
export function getUrgencyLevel(record: CancelAuditRecord): 'critical' | 'warning' | 'cancelled' | 'normal' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (record.report_type === 'cancellation') {
    return 'cancelled';
  }

  if (record.pending_cancel_date) {
    const pendingDate = new Date(record.pending_cancel_date + 'T00:00:00');
    const daysUntil = Math.ceil((pendingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= 0) return 'critical'; // Today or past
    if (daysUntil <= 3) return 'warning';  // Within 3 days
    return 'normal';
  }

  return 'normal';
}

// Get days until date (negative if past)
export function getDaysUntil(dateString: string | null): number | null {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateString + 'T00:00:00');
  return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Get display name: "TORRES, THOMAS"
export function getDisplayName(firstName: string | null, lastName: string | null): string {
  const last = lastName?.toUpperCase() || 'UNKNOWN';
  const first = firstName?.toUpperCase() || '';
  return first ? `${last}, ${first}` : last;
}

// Format phone for display
export function formatPhone(phone: string | null): string {
  if (!phone) return '--';
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone; // Return as-is if not standard format
}
