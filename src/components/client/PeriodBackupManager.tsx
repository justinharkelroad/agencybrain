import { useState, useEffect } from 'react';
import { usePeriodBackup } from '@/hooks/usePeriodBackup';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { History, Download, Clock, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PeriodBackup {
  id: string;
  created_at: string;
  backup_type: 'auto' | 'pre_save' | 'manual';
  form_data: any;
  metadata?: {
    timestamp: string;
    userAgent?: string;
  };
}

interface PeriodBackupManagerProps {
  periodId: string | undefined;
  onRestore?: () => void;
}

export function PeriodBackupManager({ periodId, onRestore }: PeriodBackupManagerProps) {
  const [open, setOpen] = useState(false);
  const [backups, setBackups] = useState<PeriodBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const { getBackups, restoreBackup, createBackup } = usePeriodBackup();

  const loadBackups = async () => {
    if (!periodId) return;
    
    setLoading(true);
    try {
      const data = await getBackups(periodId);
      setBackups(data || []);
    } catch (error) {
      console.error('Error loading backups:', error);
      toast.error('Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && periodId) {
      loadBackups();
    }
  }, [open, periodId]);

  const handleRestore = async (backupId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to restore this backup? Your current unsaved changes will be lost.'
    );
    
    if (!confirmed) return;

    const success = await restoreBackup(backupId);
    if (success) {
      setOpen(false);
      onRestore?.();
      // Reload the page to show restored data
      window.location.reload();
    }
  };

  const handleManualBackup = async () => {
    if (!periodId) return;
    
    // Get current form data from the page (would need to be passed as prop)
    toast.info('Manual backup feature requires current form data');
  };

  const getBackupTypeLabel = (type: string) => {
    switch (type) {
      case 'auto':
        return { label: 'Auto', variant: 'secondary' as const };
      case 'pre_save':
        return { label: 'Pre-Save', variant: 'default' as const };
      case 'manual':
        return { label: 'Manual', variant: 'outline' as const };
      default:
        return { label: type, variant: 'secondary' as const };
    }
  };

  if (!periodId) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          Backups
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Backup History
          </DialogTitle>
          <DialogDescription>
            View and restore previous versions of your form data. Automatic backups are created every 3 minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {backups.length} backup{backups.length !== 1 ? 's' : ''} available
            </p>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : backups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No backups found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Backups will be created automatically as you work
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {backups.map((backup) => {
                  const typeInfo = getBackupTypeLabel(backup.backup_type);
                  const backupDate = new Date(backup.created_at);
                  
                  return (
                    <div
                      key={backup.id}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(backupDate, 'MMM d, yyyy')}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(backupDate, 'h:mm:ss a')}
                          </div>

                          {backup.metadata?.userAgent && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {backup.metadata.userAgent.split(' ')[0]}
                            </p>
                          )}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(backup.id)}
                          className="gap-2"
                        >
                          <Download className="h-3 w-3" />
                          Restore
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <div className="pt-4 border-t">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Backup Protection
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Automatic backups every 3 minutes when editing</li>
                <li>• Pre-save backup created before each save operation</li>
                <li>• Backups stored securely in the database</li>
                <li>• Restore any previous version instantly</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
