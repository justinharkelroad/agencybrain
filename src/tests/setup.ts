import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock fetch for tests
global.fetch = vi.fn();

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => '12345678-1234-1234-1234-123456789012'
  }
});

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'test-agency.myagencybrain.com',
    origin: 'https://test-agency.myagencybrain.com'
  }
});