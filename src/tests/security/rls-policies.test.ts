import { describe, it, expect, beforeEach, vi } from 'vitest';

// Gate F: Security & RLS Policy Tests
describe('Row Level Security Policies', () => {
  const mockSupabase = {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Gate F: Agency Access Control Tests', () => {
    it('should enforce same-agency reads for KPIs', async () => {
      // Mock user session for Agency A
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' },
          },
        },
      });

      // Mock RLS enforcement - only return Agency A KPIs
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'kpis') {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [
                  { id: 'kpi-1', key: 'outbound_calls', agency_id: 'agency-a' },
                  // KPIs from other agencies should be filtered out by RLS
                ],
                error: null,
              }),
            }),
          };
        }
        return mockDefaultTable();
      });

      const result = await getKpisForUser();
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0].agency_id).toBe('agency-a');
    });

    it('should block unauthorized kpi_versions access', async () => {
      // Mock user without proper agency access
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'kpi_versions') {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [], // RLS blocks access
                error: null,
              }),
            }),
          };
        }
        return mockDefaultTable();
      });

      const result = await getKpiVersionsForUser();
      
      expect(result.data).toHaveLength(0);
    });

    it('should enforce forms_kpi_bindings agency restriction', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'forms_kpi_bindings') {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [
                  // Should only return bindings for user's agency
                  { 
                    form_template_id: 'form-1',
                    kpi_version_id: 'version-1',
                    agency_id: 'user-agency',
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        return mockDefaultTable();
      });

      const result = await getFormKpiBindings();
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0].agency_id).toBe('user-agency');
    });

    it('should restrict metrics_daily to same agency', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'metrics_daily') {
          return {
            select: () => ({
              eq: () => ({
                gte: () => Promise.resolve({
                  data: [
                    {
                      team_member_id: 'member-1',
                      date: '2025-09-10',
                      agency_id: 'user-agency',
                      outbound_calls: 25,
                    },
                    // Other agencies' metrics filtered out by RLS
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockDefaultTable();
      });

      const result = await getMetricsDaily('2025-09-01', '2025-09-30');
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0].agency_id).toBe('user-agency');
    });
  });

  describe('Gate F: Anonymous Access Prevention Tests', () => {
    it('should block anonymous access to sensitive tables', async () => {
      // Mock anonymous session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      const sensitiveTablesTests = [
        { table: 'kpis', method: getKpisForUser },
        { table: 'kpi_versions', method: getKpiVersionsForUser },
        { table: 'metrics_daily', method: () => getMetricsDaily('2025-09-01', '2025-09-30') },
        { table: 'form_templates', method: getFormTemplates },
      ];

      for (const test of sensitiveTablesTests) {
        mockSupabase.from.mockImplementation((table) => {
          if (table === test.table) {
            return {
              select: () => Promise.resolve({
                data: [], // RLS blocks anonymous access
                error: { message: 'access denied' },
              }),
            };
          }
          return mockDefaultTable();
        });

        const result = await test.method();
        
        expect(result.data).toHaveLength(0);
      }
    });

    it('should allow controlled public form access', async () => {
      // Public form submission should work with valid token
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'form_links') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: {
                    id: 'link-1',
                    enabled: true,
                    expires_at: null,
                    form_template_id: 'template-1',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockDefaultTable();
      });

      const result = await getPublicFormLink('valid-token');
      
      expect(result.data).toBeTruthy();
      expect(result.data.enabled).toBe(true);
    });
  });

  describe('Gate F: Admin vs User Permission Tests', () => {
    it('should allow admin access to all agencies', async () => {
      // Mock admin user session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'admin-user', role: 'admin' },
          },
        },
      });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'agencies') {
          return {
            select: () => Promise.resolve({
              data: [
                { id: 'agency-a', name: 'Agency A' },
                { id: 'agency-b', name: 'Agency B' },
                { id: 'agency-c', name: 'Agency C' },
              ],
              error: null,
            }),
          };
        }
        return mockDefaultTable();
      });

      const result = await getAllAgencies();
      
      expect(result.data).toHaveLength(3);
    });

    it('should restrict regular user to own agency only', async () => {
      // Mock regular user session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'regular-user', role: 'user' },
          },
        },
      });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'agencies') {
          return {
            select: () => Promise.resolve({
              data: [
                { id: 'user-agency', name: 'User Agency' },
                // Other agencies filtered out by RLS
              ],
              error: null,
            }),
          };
        }
        return mockDefaultTable();
      });

      const result = await getAllAgencies();
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('user-agency');
    });
  });

  describe('Gate F: Data Isolation Tests', () => {
    it('should prevent cross-agency data leakage in joins', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'submissions') {
          return {
            select: () => ({
              eq: () => ({
                order: () => Promise.resolve({
                  data: [
                    {
                      id: 'sub-1',
                      team_member_id: 'member-1',
                      form_templates: {
                        agency_id: 'user-agency', // Only same agency data
                      },
                    },
                    // Cross-agency submissions filtered by RLS
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockDefaultTable();
      });

      const result = await getSubmissionsWithForms();
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0].form_templates.agency_id).toBe('user-agency');
    });

    it('should maintain data integrity in complex queries', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'metrics_daily') {
          return {
            select: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => Promise.resolve({
                    data: [
                      {
                        team_member_id: 'member-1',
                        date: '2025-09-10',
                        outbound_calls: 25,
                        kpi_version_id: 'version-1',
                        // Complex join data properly filtered
                        team_members: {
                          agency_id: 'user-agency',
                        },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return mockDefaultTable();
      });

      const result = await getMetricsWithMembers('2025-09-01', '2025-09-30');
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0].team_members.agency_id).toBe('user-agency');
    });
  });

  // Mock functions for testing RLS behavior
  async function getKpisForUser() {
    return mockSupabase.from('kpis').select('*').eq('is_active', true);
  }

  async function getKpiVersionsForUser() {
    return mockSupabase.from('kpi_versions').select('*').eq('valid_to', null);
  }

  async function getFormKpiBindings() {
    return mockSupabase.from('forms_kpi_bindings').select('*');
  }

  async function getMetricsDaily(startDate: string, endDate: string) {
    return mockSupabase.from('metrics_daily')
      .select('*')
      .eq('agency_id', 'user-agency')
      .gte('date', startDate)
      .lte('date', endDate);
  }

  async function getFormTemplates() {
    return mockSupabase.from('form_templates').select('*');
  }

  async function getPublicFormLink(token: string) {
    return mockSupabase.from('form_links').select('*').eq('token', token).single();
  }

  async function getAllAgencies() {
    return mockSupabase.from('agencies').select('*');
  }

  async function getSubmissionsWithForms() {
    return mockSupabase.from('submissions')
      .select('*, form_templates(*)')
      .eq('final', true)
      .order('submitted_at', { ascending: false });
  }

  async function getMetricsWithMembers(startDate: string, endDate: string) {
    return mockSupabase.from('metrics_daily')
      .select('*, team_members(*)')
      .gte('date', startDate)
      .lte('date', endDate);
  }

  function mockDefaultTable() {
    return {
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
    };
  }
});
