// Pillar configuration
export const pillarColors: Record<string, string> = {
  sales_process: 'bg-blue-500',
  accountability: 'bg-amber-500',
  coaching_cadence: 'bg-green-500',
};

export const pillarLabels: Record<string, string> = {
  sales_process: 'Sales Process',
  accountability: 'Accountability',
  coaching_cadence: 'Coaching Cadence',
};

// Day labels for Mon/Wed/Fri lessons
export const dayLabels: Record<number, string> = {
  1: 'Monday',
  3: 'Wednesday',
  5: 'Friday',
};

// Progress status types
export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'not_started';

export type Pillar = 'sales_process' | 'accountability' | 'coaching_cadence';
