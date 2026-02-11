import { describe, expect, it, vi } from 'vitest';
import { createBusinessMetricsReport } from '@/hooks/useBusinessMetricsReports';

function buildSupabaseMock(options?: {
  existingReportId?: string | null;
  parseError?: unknown | null;
}) {
  const existingReportId = Object.prototype.hasOwnProperty.call(options ?? {}, 'existingReportId')
    ? options?.existingReportId ?? null
    : 'report-existing-1';
  const parseError = Object.prototype.hasOwnProperty.call(options ?? {}, 'parseError')
    ? options?.parseError
    : {
    message: 'invoke failed',
    context: {
      json: async () => ({ error: 'parser exploded' }),
    },
  };

  const upload = vi.fn().mockResolvedValue({ error: null });
  const storageFrom = vi.fn(() => ({ upload }));

  const lookupLimit = vi.fn().mockResolvedValue({
    data: existingReportId ? [{ id: existingReportId }] : [],
    error: null,
  });
  const lookupOrder = vi.fn(() => ({ limit: lookupLimit }));
  const lookupEq3 = vi.fn(() => ({ order: lookupOrder }));
  const lookupEq2 = vi.fn(() => ({ eq: lookupEq3 }));
  const lookupEq1 = vi.fn(() => ({ eq: lookupEq2 }));
  const reportsLookupSelect = vi.fn(() => ({ eq: lookupEq1 }));

  const updateSingle = vi.fn().mockResolvedValue({
    data: { id: existingReportId ?? 'report-existing-1' },
    error: null,
  });
  const updateSelect = vi.fn(() => ({ single: updateSingle }));
  const updateEq = vi.fn(() => ({ select: updateSelect }));
  const reportUpdate = vi.fn((_payload?: Record<string, unknown>) => ({ eq: updateEq }));

  const insertSingle = vi.fn().mockResolvedValue({
    data: { id: 'report-inserted-1' },
    error: null,
  });
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const reportInsert = vi.fn(() => ({ select: insertSelect }));

  const snapshotDeleteEq = vi.fn().mockResolvedValue({ error: null });
  const snapshotDelete = vi.fn(() => ({ eq: snapshotDeleteEq }));

  const markErrorEq = vi.fn().mockResolvedValue({ error: null });
  const markErrorUpdate = vi.fn(() => ({ eq: markErrorEq }));
  const parseInvoke = vi.fn().mockResolvedValue({ error: parseError ?? null });

  const from = vi.fn((table: string) => {
    if (table === 'business_metrics_reports') {
      return {
        select: reportsLookupSelect,
        insert: reportInsert,
        update: vi.fn((payload: Record<string, unknown>) => {
          if (payload.parse_status === 'error') {
            return markErrorUpdate();
          }
          return reportUpdate(payload);
        }),
      };
    }
    if (table === 'business_metrics_snapshots') {
      return {
        delete: snapshotDelete,
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    mock: {
      storage: { from: storageFrom },
      functions: { invoke: parseInvoke },
      from,
    },
    spies: {
      upload,
      snapshotDeleteEq,
      markErrorEq,
      parseInvoke,
      reportInsert,
      reportUpdate,
      lookupEq1,
      lookupEq2,
      lookupEq3,
    },
  };
}

describe('createBusinessMetricsReport hardening', () => {
  it('rejects non-xlsx files before any upload attempt', async () => {
    const { mock, spies } = buildSupabaseMock();
    const file = new File(['binary'], 'metrics.csv', { type: 'text/csv' });

    await expect(
      createBusinessMetricsReport({
        agencyId: 'agency-1',
        userId: 'user-1',
        input: {
          file,
          reportMonth: '2026-01',
          carrierSchemaId: 'carrier-schema-1',
          carrierSchemaKey: 'allstate',
        },
        supabaseClient: mock as never,
      })
    ).rejects.toThrow('Only .xlsx files are supported.');

    expect(spies.upload).not.toHaveBeenCalled();
  });

  it('deletes stale snapshots and marks report errored when parse invoke fails', async () => {
    const { mock, spies } = buildSupabaseMock();
    const file = new File(['binary'], 'metrics.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    await expect(
      createBusinessMetricsReport({
        agencyId: 'agency-1',
        userId: 'user-1',
        input: {
          file,
          reportMonth: '2026-01',
          carrierSchemaId: 'carrier-schema-1',
          carrierSchemaKey: 'allstate',
          bonusProjectionDollars: 1234,
        },
        supabaseClient: mock as never,
      })
    ).rejects.toThrow('parser exploded');

    expect(spies.snapshotDeleteEq).toHaveBeenCalledWith('report_id', 'report-existing-1');
    expect(spies.markErrorEq).toHaveBeenCalledWith('id', 'report-existing-1');
    expect(spies.parseInvoke).toHaveBeenCalledWith('parse_business_metrics', {
      body: {
        report_id: 'report-existing-1',
        carrier_schema_key: 'allstate',
      },
    });
    expect(spies.lookupEq1).toHaveBeenCalledWith('agency_id', 'agency-1');
    expect(spies.lookupEq2).toHaveBeenCalledWith('report_month', '2026-01-01');
    expect(spies.lookupEq3).toHaveBeenCalledWith('carrier_schema_id', 'carrier-schema-1');

    expect(spies.snapshotDeleteEq.mock.invocationCallOrder[0]).toBeLessThan(
      spies.markErrorEq.mock.invocationCallOrder[0]
    );
  });

  it('uses fallback parse error message when function context is unavailable', async () => {
    const { mock, spies } = buildSupabaseMock({
      parseError: new Error('network edge timeout'),
    });
    const file = new File(['binary'], 'metrics.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    await expect(
      createBusinessMetricsReport({
        agencyId: 'agency-1',
        userId: 'user-1',
        input: {
          file,
          reportMonth: '2026-01',
          carrierSchemaId: 'carrier-schema-1',
          carrierSchemaKey: 'allstate',
        },
        supabaseClient: mock as never,
      })
    ).rejects.toThrow('network edge timeout');

    expect(spies.markErrorEq).toHaveBeenCalledWith('id', 'report-existing-1');
  });

  it('inserts a new report when no existing row matches month+carrier schema', async () => {
    const { mock, spies } = buildSupabaseMock({
      existingReportId: null,
      parseError: null,
    });
    const file = new File(['binary'], 'metrics.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const result = await createBusinessMetricsReport({
      agencyId: 'agency-1',
      userId: 'user-1',
      input: {
        file,
        reportMonth: '2026-01',
        carrierSchemaId: 'carrier-schema-1',
        carrierSchemaKey: 'allstate',
      },
      supabaseClient: mock as never,
    });

    expect(result.id).toBe('report-inserted-1');
    expect(spies.reportInsert).toHaveBeenCalled();
    expect(spies.reportUpdate).not.toHaveBeenCalled();
    expect(spies.snapshotDeleteEq).not.toHaveBeenCalled();
    expect(spies.parseInvoke).toHaveBeenCalledWith('parse_business_metrics', {
      body: {
        report_id: 'report-inserted-1',
        carrier_schema_key: 'allstate',
      },
    });
  });
});
