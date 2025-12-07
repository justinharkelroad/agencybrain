import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, AlertCircle, CheckCircle, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PeriodVersion {
  id: string;
  period_id: string;
  form_data: any;
  title: string;
  status: string;
  valid_from: string;
  valid_to: string | null;
  changed_by: string | null;
  change_source: string;
  data_completeness_score: number;
  has_meaningful_data: boolean;
}

interface PeriodVersionHistoryProps {
  periodId: string;
}

export function PeriodVersionHistory({ periodId }: PeriodVersionHistoryProps) {
  const [versions, setVersions] = useState<PeriodVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVersions();
  }, [periodId]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('period_versions')
        .select('*')
        .eq('period_id', periodId)
        .order('valid_from', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Error loading versions:', error);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const restoreVersion = async (version: PeriodVersion) => {
    try {
      const { error } = await supabase
        .from('periods')
        .update({ 
          form_data: version.form_data,
          title: version.title,
          status: version.status,
        })
        .eq('id', periodId);

      if (error) throw error;

      toast.success('Version restored successfully');
      await loadVersions();
    } catch (error) {
      console.error('Error restoring version:', error);
      toast.error('Failed to restore version');
    }
  };

  const getChangeSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      initial_creation: 'Initial Creation',
      user_edit: 'User Edit',
      backfill_initial: 'System Backfill',
      auto_save: 'Auto Save',
    };
    return labels[source] || source;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Version History
          </CardTitle>
          <CardDescription>Loading version history...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Version History
        </CardTitle>
        <CardDescription>
          View and restore previous versions of this period
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {index === 0 && (
                        <Badge variant="default">Current</Badge>
                      )}
                      <span className="text-sm font-medium">
                        {format(new Date(version.valid_from), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getChangeSourceLabel(version.change_source)}
                    </p>
                  </div>
                  {index > 0 && (
                    <Button
                      variant="flat"
                      size="sm"
                      onClick={() => restoreVersion(version)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restore
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    {version.has_meaningful_data ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span>
                      {version.has_meaningful_data ? 'Has Data' : 'Empty'}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    Completeness: {version.data_completeness_score}%
                  </div>
                  <Badge variant="outline">{version.status}</Badge>
                </div>

                {!version.has_meaningful_data && index === 0 && (
                  <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                    ⚠️ Current version appears to be empty. Consider restoring a previous version.
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
