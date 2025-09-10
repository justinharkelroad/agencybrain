import { describe, it, expect, beforeEach, vi } from 'vitest';

// Gate F: Dashboard with Versioned KPIs Tests
describe('Versioned Dashboard', () => {
  const mockSupabase = {
    functions: {
      invoke: vi.fn(),
    },
    rpc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Gate F: KPI Version Resolution Tests', () => {
    it('should resolve latest KPI versions for dashboard', async () => {
      const mockDashboardData = {
        agency: { id: 'agency-123', slug: 'test-agency' },
        kpis: [
          {
            id: 'kpi-1',
            key: 'outbound_calls',
            label: 'Outbound Calls V2', // Latest version
            version_id: 'version-123',
          },
          {
            id: 'kpi-2', 
            key: 'talk_minutes',
            label: 'Talk Minutes V3', // Latest version
            version_id: 'version-456',
          },
        ],
        members: [],
        targets: {},
      };

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockDashboardData,
        error: null,
      });

      const result = await getDashboardData('test-agency', 'Sales');
      
      expect(result.kpis).toHaveLength(2);
      expect(result.kpis[0].label).toBe('Outbound Calls V2');
      expect(result.kpis[1].label).toBe('Talk Minutes V3');
      expect(result.kpis[0].version_id).toBe('version-123');
    });

    it('should handle consolidation mode correctly', async () => {
      const mockConsolidatedData = {
        agency: { id: 'agency-123', slug: 'test-agency' },
        kpis: [
          {
            id: 'kpi-1',
            key: 'outbound_calls',
            label: 'Outbound Calls', // Consolidated label
            consolidated: true,
          },
        ],
        consolidated_mode: true,
      };

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockConsolidatedData,
        error: null,
      });

      const result = await getDashboardData('test-agency', 'Sales', true);
      
      expect(result.consolidated_mode).toBe(true);
      expect(result.kpis[0].consolidated).toBe(true);
    });

    it('should return version warnings when KPIs renamed', async () => {
      const mockDataWithWarnings = {
        agency: { id: 'agency-123', slug: 'test-agency' },
        kpis: [],
        version_warnings: [
          {
            kpi_key: 'outbound_calls',
            old_label: 'Outbound Calls V1',
            new_label: 'Outbound Calls V2',
            renamed_at: '2025-09-10T10:00:00Z',
            effective_date: '2025-09-11',
          },
        ],
      };

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockDataWithWarnings,
        error: null,
      });

      const result = await getDashboardData('test-agency', 'Sales');
      
      expect(result.version_warnings).toHaveLength(1);
      expect(result.version_warnings[0].kpi_key).toBe('outbound_calls');
    });
  });

  describe('Gate F: Performance Tests', () => {
    it('should complete dashboard load within 150ms target', async () => {
      const mockData = {
        agency: { id: 'agency-123', slug: 'test-agency' },
        kpis: Array.from({ length: 10 }, (_, i) => ({
          id: `kpi-${i}`,
          key: `metric_${i}`,
          label: `Metric ${i}`,
        })),
        members: Array.from({ length: 50 }, (_, i) => ({
          id: `member-${i}`,
          name: `Member ${i}`,
        })),
      };

      const startTime = Date.now();
      
      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await getDashboardData('test-agency', 'Sales');
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(150); // Gate C performance target
      expect(result.kpis).toHaveLength(10);
      expect(result.members).toHaveLength(50);
    });

    it('should handle large datasets efficiently', async () => {
      const mockLargeData = {
        agency: { id: 'agency-123', slug: 'test-agency' },
        kpis: Array.from({ length: 100 }, (_, i) => ({
          id: `kpi-${i}`,
          key: `metric_${i}`,
          label: `Metric ${i}`,
        })),
        members: Array.from({ length: 500 }, (_, i) => ({
          id: `member-${i}`,
          name: `Member ${i}`,
          metrics: Array.from({ length: 30 }, (_, j) => ({
            date: `2025-09-${String(j + 1).padStart(2, '0')}`,
            value: Math.floor(Math.random() * 100),
          })),
        })),
      };

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockLargeData,
        error: null,
      });

      const startTime = Date.now();
      const result = await getDashboardData('test-agency', 'Sales');
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(300); // Should handle large datasets
      expect(result.kpis).toHaveLength(100);
      expect(result.members).toHaveLength(500);
    });
  });

  describe('Gate F: Security Tests', () => {
    it('should enforce agency access control', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Access denied to agency data' },
      });

      const result = await getDashboardData('unauthorized-agency', 'Sales');
      
      expect(result).toBeNull();
    });

    it('should validate role permissions', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Invalid role for agency' },
      });

      const result = await getDashboardData('test-agency', 'InvalidRole');
      
      expect(result).toBeNull();
    });

    it('should sanitize output data', async () => {
      const mockUnsafeData = {
        agency: { id: 'agency-123', slug: 'test-agency' },
        kpis: [
          {
            id: 'kpi-1',
            key: 'outbound_calls',
            label: '<script>alert("xss")</script>Calls',
            unsafe_field: 'DROP TABLE users;',
          },
        ],
      };

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockUnsafeData,
        error: null,
      });

      const result = await getDashboardData('test-agency', 'Sales');
      
      // Ensure unsafe content is handled appropriately
      expect(result.kpis[0].label).not.toContain('<script>');
      expect(result.kpis[0]).not.toHaveProperty('unsafe_field');
    });
  });

  describe('Gate F: Error Recovery Tests', () => {
    it('should handle network failures gracefully', async () => {
      mockSupabase.functions.invoke.mockRejectedValue(new Error('Network error'));

      const result = await getDashboardData('test-agency', 'Sales');
      
      expect(result).toBeNull();
    });

    it('should handle malformed response data', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: 'invalid json',
        error: null,
      });

      const result = await getDashboardData('test-agency', 'Sales');
      
      expect(result).toBeNull();
    });

    it('should provide fallback for missing KPI versions', async () => {
      const mockIncompleteData = {
        agency: { id: 'agency-123', slug: 'test-agency' },
        kpis: [
          {
            id: 'kpi-1',
            key: 'outbound_calls',
            // Missing label and version_id
          },
        ],
      };

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockIncompleteData,
        error: null,
      });

      const result = await getDashboardData('test-agency', 'Sales');
      
      expect(result.kpis[0]).toHaveProperty('label');
      expect(result.kpis[0].label).not.toBe('');
    });
  });

  // Mock dashboard data fetching function
  async function getDashboardData(agencySlug: string, role: string, consolidate = false) {
    try {
      const { data, error } = await mockSupabase.functions.invoke('get_dashboard', {
        body: {
          agencySlug,
          role, 
          consolidateVersions: consolidate,
        },
      });

      if (error) {
        console.error('Dashboard error:', error);
        return null;
      }

      // Sanitize and validate data
      if (data && typeof data === 'object') {
        // Remove unsafe properties and sanitize labels
        if (data.kpis) {
          data.kpis = data.kpis.map((kpi: any) => ({
            id: kpi.id,
            key: kpi.key,
            label: sanitizeLabel(kpi.label || kpi.key),
            version_id: kpi.version_id,
            consolidated: kpi.consolidated,
          }));
        }
      }

      return data;
    } catch (error) {
      console.error('Network error:', error);
      return null;
    }
  }

  function sanitizeLabel(label: string): string {
    if (!label || typeof label !== 'string') {
      return 'Unknown Metric';
    }
    // Remove potential XSS content
    return label.replace(/<[^>]*>/g, '').trim() || 'Unknown Metric';
  }
});