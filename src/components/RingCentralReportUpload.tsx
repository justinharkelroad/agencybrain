import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Upload, Loader2, CheckCircle, Copy, FileSpreadsheet, Clock, Mail, ChevronDown, ChevronRight, AlertCircle, XCircle } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';

interface UploadResult {
  success: boolean;
  file_type: 'calls' | 'users';
  report_date: string;
  calls_processed: number;
  calls_skipped_duplicate: number;
  calls_skipped_internal: number;
  team_members_matched: number;
  prospects_matched: number;
  contact_activities_inserted: number;
  metrics_upserted: number;
  row_errors: number;
}

interface IngestLog {
  id: string;
  sender: string | null;
  subject: string | null;
  status: 'success' | 'partial' | 'failed' | 'rejected';
  attachment_count: number;
  files_processed: number;
  processing_results: Record<string, unknown>[];
  error_message: string | null;
  processing_duration_ms: number | null;
  created_at: string;
}

interface RingCentralReportUploadProps {
  agencyId: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  success: { label: 'Success', variant: 'default' },
  partial: { label: 'Partial', variant: 'secondary' },
  failed: { label: 'Failed', variant: 'destructive' },
  rejected: { label: 'Rejected', variant: 'outline' },
};

export function RingCentralReportUpload({ agencyId }: RingCentralReportUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [lastImport, setLastImport] = useState<string | null>(null);
  const [rcIngestKey, setRcIngestKey] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [ingestLogs, setIngestLogs] = useState<IngestLog[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    fetchLastImport();
    fetchIngestKey();
    fetchIngestLogs();
  }, [agencyId]);

  const fetchLastImport = async () => {
    try {
      const { data } = await supabase
        .from('call_events')
        .select('created_at')
        .eq('provider', 'ringcentral')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setLastImport(data?.created_at || null);
    } catch (err) {
      console.error('Error fetching last import:', err);
    }
  };

  const fetchIngestKey = async () => {
    try {
      const { data } = await supabase
        .from('agencies')
        .select('rc_ingest_key')
        .eq('id', agencyId)
        .maybeSingle();

      setRcIngestKey((data as any)?.rc_ingest_key || null);
    } catch (err) {
      // rc_ingest_key may not exist yet
    }
  };

  const fetchIngestLogs = async () => {
    try {
      const { data } = await supabase
        .from('email_ingest_logs' as any)
        .select('id, sender, subject, status, attachment_count, files_processed, processing_results, error_message, processing_duration_ms, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(20);

      setIngestLogs((data as any as IngestLog[]) || []);
    } catch (err) {
      // Table may not exist yet
    }
  };

  const handleCopyEmail = () => {
    if (!rcIngestKey) return;
    const email = `calls-${rcIngestKey}@ingest.myagencybrain.com`;
    navigator.clipboard.writeText(email);
    toast.success('Ingest email copied to clipboard');
  };

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Please upload an .xlsx file');
      return;
    }

    const date = new Date().toISOString().split('T')[0];
    const storagePath = `${agencyId}/${date}/${file.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('rc-reports')
      .upload(storagePath, file, { upsert: true });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    console.log(`[RC Upload] File uploaded to: ${storagePath}`, uploadData);

    const { data, error } = await supabase.functions.invoke('ringcentral-report-ingest', {
      body: { agency_id: agencyId, storage_path: storagePath },
    });

    console.log('[RC Upload] Function response:', data, error);
    if (error) {
      const context = (error as any)?.context;
      if (context?.json) {
        try {
          const body = await context.json();
          throw new Error(body?.error || error.message);
        } catch { /* fall through */ }
      }
      throw error;
    }
    if (!data?.success) throw new Error(data?.error || 'Processing failed');

    return data as UploadResult;
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const xlsxFiles = Array.from(files).filter(f => f.name.endsWith('.xlsx'));
    if (xlsxFiles.length === 0) {
      toast.error('Please upload .xlsx files');
      return;
    }

    setUploading(true);
    setResults([]);

    const newResults: UploadResult[] = [];

    for (const file of xlsxFiles) {
      try {
        const result = await processFile(file);
        if (result) newResults.push(result);
      } catch (err: any) {
        console.error(`Upload error for ${file.name}:`, err);
        toast.error(`${file.name}: ${err.message || 'Processing failed'}`);
      }
    }

    if (newResults.length > 0) {
      setResults(newResults);
      const callsResult = newResults.find(r => r.file_type === 'calls');
      const usersResult = newResults.find(r => r.file_type === 'users');
      const parts: string[] = [];
      if (callsResult) parts.push(`${callsResult.calls_processed} calls imported`);
      if (usersResult) parts.push(`${usersResult.metrics_upserted} user metrics updated`);
      toast.success(parts.join(', ') || 'Reports processed');
      fetchLastImport();
    }

    setUploading(false);
  }, [agencyId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const callsResult = results.find(r => r.file_type === 'calls');
  const usersResult = results.find(r => r.file_type === 'users');

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
      case 'partial': return <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />;
      case 'failed': return <XCircle className="h-3.5 w-3.5 text-red-600" />;
      case 'rejected': return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
      default: return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <FileSpreadsheet className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">RingCentral Report Upload</CardTitle>
            <CardDescription>Upload the Calls and Users reports from RingCentral</CardDescription>
          </div>
          <HelpButton videoKey="Ringcentral_automation" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ingest Email */}
        {rcIngestKey && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Ingest email:</span>
            <code className="rounded bg-muted px-2 py-0.5 text-xs">
              calls-{rcIngestKey}@ingest.myagencybrain.com
            </code>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopyEmail}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Upload Zone */}
        <div
          className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            dragOver ? 'border-blue-500 bg-blue-500/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Processing reports...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop both .xlsx reports here, or click to select
              </p>
              <p className="text-xs text-muted-foreground">
                Accepts the Calls report and/or Users report
              </p>
              <label>
                <input
                  type="file"
                  accept=".xlsx"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span>Choose Files</span>
                </Button>
              </label>
            </div>
          )}
        </div>

        {/* Calls Result */}
        {callsResult && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Calls Report — {callsResult.report_date}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Calls imported:</span>
              <span className="font-medium text-foreground">{callsResult.calls_processed}</span>
              <span>Duplicates skipped:</span>
              <span>{callsResult.calls_skipped_duplicate}</span>
              <span>Internal skipped:</span>
              <span>{callsResult.calls_skipped_internal}</span>
              <span>Team members matched:</span>
              <span>{callsResult.team_members_matched}</span>
              <span>Prospects matched:</span>
              <span>{callsResult.prospects_matched}</span>
              {callsResult.row_errors > 0 && (
                <>
                  <span className="text-destructive">Row errors:</span>
                  <span className="text-destructive">{callsResult.row_errors}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Users Result */}
        {usersResult && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Users Report — {usersResult.report_date}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Metrics updated:</span>
              <span className="font-medium text-foreground">{usersResult.metrics_upserted}</span>
            </div>
          </div>
        )}

        {/* Last Import Info */}
        {lastImport && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Last import: {new Date(lastImport).toLocaleString()}
          </div>
        )}

        {/* Email Ingest Logs */}
        {ingestLogs.length > 0 && (
          <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between px-2 text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-2 text-xs">
                  <Mail className="h-3.5 w-3.5" />
                  Email Ingest History ({ingestLogs.length})
                </span>
                {logsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {ingestLogs.map(log => (
                <div key={log.id} className="rounded-lg border bg-muted/30 text-sm">
                  <button
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                  >
                    <StatusIcon status={log.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-medium">
                          {log.subject || log.sender || 'No subject'}
                        </span>
                        <Badge variant={statusConfig[log.status]?.variant || 'outline'} className="text-[10px] px-1.5 py-0">
                          {statusConfig[log.status]?.label || log.status}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                        {log.files_processed > 0 && ` — ${log.files_processed} file${log.files_processed !== 1 ? 's' : ''} processed`}
                        {log.processing_duration_ms != null && ` (${(log.processing_duration_ms / 1000).toFixed(1)}s)`}
                      </div>
                    </div>
                    {expandedLogId === log.id ? (
                      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {expandedLogId === log.id && (
                    <div className="border-t px-3 py-2 space-y-1.5 text-xs text-muted-foreground">
                      {log.sender && <div><span className="font-medium text-foreground">From:</span> {log.sender}</div>}
                      {log.error_message && (
                        <div className="text-destructive"><span className="font-medium">Error:</span> {log.error_message}</div>
                      )}
                      {log.processing_results && Array.isArray(log.processing_results) && log.processing_results.length > 0 && (
                        <div className="space-y-1">
                          {log.processing_results.map((fr: any, i: number) => (
                            <div key={i} className="rounded bg-muted/50 px-2 py-1">
                              <span className="font-medium text-foreground">{fr.file || `File ${fr.index}`}</span>
                              {fr.type && <span className="ml-1">({fr.type})</span>}
                              {' — '}
                              {fr.success === true ? (
                                <span className="text-green-600">
                                  {fr.metrics_upserted != null && `${fr.metrics_upserted} metrics`}
                                  {fr.calls_processed != null && `${fr.calls_processed} calls`}
                                  {fr.calls_parsed != null && `${fr.calls_parsed} calls parsed`}
                                </span>
                              ) : fr.success === false ? (
                                <span className="text-red-600">{fr.error || 'Failed'}</span>
                              ) : (
                                <span>{fr.status || 'Unknown'}{fr.error ? `: ${fr.error}` : ''}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
