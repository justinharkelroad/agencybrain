import { useState, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { BarChart3, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { ParseResult, OfficeHours, AgentSummary } from '@/components/call-gaps/types';
import type { CallGapDbRecord } from '@/components/call-gaps/CallGapsParser';
import { parseCallFile, computeGapsForAgent, buildParseResultFromRecords } from '@/components/call-gaps/CallGapsParser';
import CallGapsUploader from '@/components/call-gaps/CallGapsUploader';
import CallGapsSummary from '@/components/call-gaps/CallGapsSummary';
import CallGapsBarCharts from '@/components/call-gaps/CallGapsBarCharts';
import CallGapsTimeline from '@/components/call-gaps/CallGapsTimeline';
import CallGapsTable from '@/components/call-gaps/CallGapsTable';
import CallGapsHistory from '@/components/call-gaps/CallGapsHistory';
import { useAuth } from '@/lib/auth';
import { HelpButton } from '@/components/HelpButton';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { fetchWithAuth } from '@/lib/staffRequest';
import {
  useCallGapUploads,
  useSaveCallGapUpload,
  useDeleteCallGapUpload,
  type SaveUploadPayload,
} from '@/hooks/useCallGapData';

// Generate time options from 6:00 AM to 10:00 PM in 30-min increments
function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const label = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
      options.push({ value, label });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();
const THRESHOLD_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CallGaps() {
  const location = useLocation();
  const isStaffPortal = location.pathname.startsWith('/staff');

  // Auth context — determine agencyId for query enabling
  const { user } = useAuth();
  const { user: staffUser } = useStaffAuth();
  const agencyId = isStaffPortal ? staffUser?.agency_id : (user?.id ? 'authenticated' : undefined);

  // Local state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [officeHours, setOfficeHours] = useState<OfficeHours>({ start: '08:00', end: '18:00' });
  const [gapThresholdMinutes, setGapThresholdMinutes] = useState(15);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loadingUploadId, setLoadingUploadId] = useState<string | null>(null);

  // Stores the full record set when loaded from DB, so date switching works
  const allDbRecordsRef = useRef<{ records: CallGapDbRecord[]; sourceFormat: 'ringcentral' | 'ricochet' } | null>(null);

  // Persistence hooks
  const { data: uploads, isLoading: uploadsLoading } = useCallGapUploads(agencyId);
  const saveUpload = useSaveCallGapUpload();
  const deleteUpload = useDeleteCallGapUpload();

  // Recompute gaps when office hours change
  const agentsWithGaps: AgentSummary[] = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.agents.map((agent) => ({
      ...agent,
      gaps: computeGapsForAgent(agent.calls, officeHours, selectedDate),
    }));
  }, [parseResult, officeHours, selectedDate]);

  const handleFileSelected = useCallback(
    async (file: File) => {
      setSelectedFile(file);
      setIsProcessing(true);
      setError(null);
      allDbRecordsRef.current = null;
      try {
        const result = await parseCallFile(file);
        const date = result.availableDates[0];
        if (!date) throw new Error('No calls found in file.');

        setParseResult(result);
        setSelectedDate(date);
        toast.success(
          `Loaded ${result.rawCallCount} calls from ${result.sourceFormat === 'ringcentral' ? 'RingCentral' : 'Ricochet'} export`
        );

        // Auto-save to database if authenticated
        if (agencyId) {
          // Collect calls across ALL dates for saving (not just the selected date)
          const allRecords: SaveUploadPayload['records'] = [];
          for (const d of result.availableDates) {
            const dateResult = await parseCallFile(file, d);
            for (const agent of dateResult.agents) {
              for (const call of agent.calls) {
                allRecords.push({
                  agent_name: call.agentName,
                  call_start: call.callStart.toISOString(),
                  call_date: toDateString(call.callStart),
                  duration_seconds: call.durationSeconds,
                  direction: call.direction,
                  contact_name: call.contactName,
                  contact_phone: call.contactPhone,
                  result: call.result,
                });
              }
            }
          }

          saveUpload.mutate(
            {
              fileName: file.name,
              sourceFormat: result.sourceFormat,
              rawCallCount: result.rawCallCount,
              records: allRecords,
            },
            {
              onSuccess: (data) => {
                const skipped = data.duplicatesSkipped;
                if (skipped > 0) {
                  toast.info(`Saved to history (${skipped} duplicate records skipped)`);
                } else {
                  toast.success('Saved to history');
                }
              },
              onError: (err) => {
                console.error('Failed to save upload:', err);
                toast.error('Failed to save to history');
              },
            }
          );
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to parse file. Make sure it\'s a valid RingCentral (.xlsx) or Ricochet (.csv) export.';
        setError(message);
        toast.error(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [agencyId, saveUpload]
  );

  const handleDateChange = useCallback(
    async (date: string) => {
      if (!selectedFile && !allDbRecordsRef.current) return;
      setSelectedDate(date);
      setIsProcessing(true);
      setError(null);
      try {
        if (selectedFile) {
          // File-based: re-parse for new date
          const result = await parseCallFile(selectedFile, date);
          setParseResult(result);
        } else if (allDbRecordsRef.current) {
          // DB-based: rebuild from the full stored record set
          const { records, sourceFormat } = allDbRecordsRef.current;
          const rebuilt = buildParseResultFromRecords(records, sourceFormat, date, officeHours);
          setParseResult(rebuilt);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to parse file for selected date.';
        setError(message);
        toast.error(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedFile, officeHours]
  );

  const handleLoadFromHistory = useCallback(
    async (uploadId: string) => {
      setLoadingUploadId(uploadId);
      setError(null);
      try {
        const res = await fetchWithAuth('call-gap-data', {
          body: { operation: 'get_records', uploadId },
        });
        if (!res.ok) throw new Error('Failed to load records');
        const data = await res.json();

        const records = data.records;
        const sourceFormat = data.sourceFormat;

        if (!records || records.length === 0) {
          toast.error('No records found for this upload');
          return;
        }

        // Get available dates from records
        const dateSet = new Set<string>();
        for (const r of records) {
          dateSet.add(r.call_date);
        }
        const dates = Array.from(dateSet).sort().reverse();
        const firstDate = dates[0];

        // Store full record set for date switching
        allDbRecordsRef.current = { records, sourceFormat };

        const result = buildParseResultFromRecords(records, sourceFormat, firstDate, officeHours);
        setParseResult(result);
        setSelectedDate(firstDate);
        setSelectedFile(null); // Clear file reference since we loaded from DB
        toast.success(`Loaded ${records.length} records from history`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load from history';
        setError(message);
        toast.error(message);
      } finally {
        setLoadingUploadId(null);
      }
    },
    [officeHours]
  );

  const handleDeleteUpload = useCallback(
    (uploadId: string) => {
      deleteUpload.mutate(uploadId, {
        onSuccess: () => toast.success('Upload deleted'),
        onError: () => toast.error('Failed to delete upload'),
      });
    },
    [deleteUpload]
  );

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setParseResult(null);
    setSelectedDate('');
    setError(null);
    setZoomLevel(1);
    allDbRecordsRef.current = null;
  }, []);

  const hasData = parseResult && agentsWithGaps.length > 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Call Gaps Analyzer
            <HelpButton videoKey="Call_Gap" />
          </h1>
          <p className="text-muted-foreground">
            Upload phone system exports to visualize call activity and identify idle gaps
          </p>
        </div>
        {parseResult && (
          <Badge variant="outline" className="text-sm">
            {parseResult.sourceFormat === 'ringcentral' ? 'RingCentral' : 'Ricochet'} ·{' '}
            {parseResult.rawCallCount} calls
          </Badge>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Upload History */}
      {agencyId && (
        <CallGapsHistory
          uploads={uploads || []}
          isLoading={uploadsLoading}
          onLoad={handleLoadFromHistory}
          onDelete={handleDeleteUpload}
          loadingUploadId={loadingUploadId}
          deletingUploadId={deleteUpload.isPending ? (deleteUpload.variables as string) : null}
        />
      )}

      {/* Upload zone (when no data) */}
      {!hasData && (
        <CallGapsUploader
          onFileSelected={handleFileSelected}
          selectedFile={selectedFile}
          onClear={handleClear}
          isProcessing={isProcessing}
        />
      )}

      {/* Controls bar */}
      {hasData && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              {/* Date picker */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <Select value={selectedDate} onValueChange={handleDateChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {parseResult!.availableDates.map((d) => (
                      <SelectItem key={d} value={d}>
                        {formatDateLabel(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Office hours start */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Start</label>
                <Select
                  value={officeHours.start}
                  onValueChange={(v) => setOfficeHours((prev) => ({ ...prev, start: v }))}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Office hours end */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">End</label>
                <Select
                  value={officeHours.end}
                  onValueChange={(v) => setOfficeHours((prev) => ({ ...prev, end: v }))}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Gap threshold */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Gap Threshold</label>
                <Select
                  value={String(gapThresholdMinutes)}
                  onValueChange={(v) => setGapThresholdMinutes(Number(v))}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THRESHOLD_OPTIONS.map((t) => (
                      <SelectItem key={t} value={String(t)}>
                        {t} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Zoom slider */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Zoom: {zoomLevel}x
                </label>
                <div className="w-[120px] pt-1">
                  <Slider
                    min={1}
                    max={5}
                    step={0.5}
                    value={[zoomLevel]}
                    onValueChange={([v]) => setZoomLevel(v)}
                  />
                </div>
              </div>

              {/* Upload new */}
              <Button variant="outline" size="sm" onClick={handleClear} className="ml-auto">
                <RotateCcw className="h-4 w-4 mr-1" />
                Upload New
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      {hasData && (
        <CallGapsSummary
          agents={agentsWithGaps}
          gapThresholdMinutes={gapThresholdMinutes}
          officeHours={officeHours}
        />
      )}

      {/* Bar charts */}
      {hasData && <CallGapsBarCharts agents={agentsWithGaps} />}

      {/* Timeline */}
      {hasData && (
        <CallGapsTimeline
          agents={agentsWithGaps}
          officeHours={officeHours}
          gapThresholdMinutes={gapThresholdMinutes}
          zoomLevel={zoomLevel}
        />
      )}

      {/* Gap table */}
      {hasData && (
        <CallGapsTable agents={agentsWithGaps} gapThresholdMinutes={gapThresholdMinutes} />
      )}

      {/* No calls for date */}
      {parseResult && agentsWithGaps.length === 0 && !error && (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No calls found for this date.
        </div>
      )}
    </div>
  );
}
