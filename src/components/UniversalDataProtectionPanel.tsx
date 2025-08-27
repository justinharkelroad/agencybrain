import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shield, 
  Download, 
  Upload, 
  RotateCcw, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Database,
  HardDrive,
  Wifi,
  WifiOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UniversalDataBackup, UniversalBackupMetadata } from '@/lib/universalDataProtection';

interface UniversalDataProtectionPanelProps<T> {
  status: any;
  backups: UniversalDataBackup<T>[];
  onCreateBackup: () => void;
  onExportData: () => void;
  onImportData: () => void;
  onRestoreBackup: (timestamp: string) => void;
  onToggleAutoBackup: () => void;
  onValidateData: () => void;
  validationResult?: any;
  className?: string;
}

export function UniversalDataProtectionPanel<T>({
  status,
  backups,
  onCreateBackup,
  onExportData,
  onImportData,
  onRestoreBackup,
  onToggleAutoBackup,
  onValidateData,
  validationResult,
  className
}: UniversalDataProtectionPanelProps<T>) {
  const getSyncStatusInfo = () => {
    switch (status.syncStatus) {
      case 'synced':
        return { icon: Database, color: 'text-green-500', label: 'Synced' };
      case 'pending':
        return { icon: Clock, color: 'text-yellow-500', label: 'Syncing...' };
      case 'failed':
        return { icon: AlertTriangle, color: 'text-red-500', label: 'Sync Failed' };
      case 'offline':
        return { icon: WifiOff, color: 'text-gray-500', label: 'Offline' };
      default:
        return { icon: Wifi, color: 'text-blue-500', label: 'Unknown' };
    }
  };

  const syncInfo = getSyncStatusInfo();
  const SyncIcon = syncInfo.icon;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Data Protection</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <SyncIcon className={cn("h-4 w-4", syncInfo.color)} />
            <Badge variant={status.isHealthy ? "default" : "destructive"}>
              {status.isHealthy ? "Healthy" : "Needs Attention"}
            </Badge>
          </div>
        </div>
        <CardDescription>
          Secure backup and recovery system for your form data
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="backup" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="backup">Backup</TabsTrigger>
            <TabsTrigger value="recovery">Recovery</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
          </TabsList>
          
          <TabsContent value="backup" className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Manual Backup</div>
                  <div className="text-xs text-muted-foreground">
                    Create an instant backup of your current data
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onCreateBackup}
                  className="flex items-center gap-2"
                >
                  <HardDrive className="h-4 w-4" />
                  Backup Now
                </Button>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Export Data</div>
                  <div className="text-xs text-muted-foreground">
                    Download your data as a file
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onExportData}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Auto-Backup</div>
                  <div className="text-xs text-muted-foreground">
                    Automatically backup changes every 30 seconds
                  </div>
                </div>
                <Switch 
                  checked={status.autoBackupEnabled} 
                  onCheckedChange={onToggleAutoBackup}
                />
              </div>
              
              {status.lastBackup && (
                <div className="text-xs text-muted-foreground">
                  Last backup: {new Date(status.lastBackup).toLocaleString()}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="recovery" className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Import Data</div>
                  <div className="text-xs text-muted-foreground">
                    Restore data from a backup file
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onImportData}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="text-sm font-medium">Recent Backups</div>
                <ScrollArea className="h-48">
                  {backups.length > 0 ? (
                    <div className="space-y-2">
                      {backups.slice(0, 10).map((backup) => (
                        <div 
                          key={backup.metadata.timestamp}
                          className="flex items-center justify-between p-2 border rounded-md"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">
                              {new Date(backup.metadata.timestamp).toLocaleString()}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="secondary" className="text-xs">
                                Local
                              </Badge>
                              <span>
                                {Math.round(JSON.stringify(backup.formData).length / 1024)}KB
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRestoreBackup(backup.metadata.timestamp)}
                            className="flex items-center gap-1 ml-2"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Restore
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No backups available</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="status" className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">System Health</div>
                  <div className="flex items-center gap-2">
                    {status.isHealthy ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">
                      {status.isHealthy ? 'All systems operational' : 'Needs attention'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium">Backup Count</div>
                  <div className="text-sm">{status.backupCount} backups stored</div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Data Validation</div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onValidateData}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Check Now
                  </Button>
                </div>
                
                {validationResult && (
                  <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Validation Status:</span>
                      <Badge variant={validationResult.isValid ? "default" : "destructive"}>
                        {validationResult.isValid ? "Valid" : "Issues Found"}
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      Completeness: {Math.round(validationResult.completeness * 100)}%
                    </div>
                    
                    {validationResult.errors.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-red-600">Errors:</div>
                        {validationResult.errors.map((error: string, index: number) => (
                          <div key={index} className="text-xs text-red-600">• {error}</div>
                        ))}
                      </div>
                    )}
                    
                    {validationResult.warnings.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-yellow-600">Warnings:</div>
                        {validationResult.warnings.map((warning: string, index: number) => (
                          <div key={index} className="text-xs text-yellow-600">• {warning}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {status.lastValidated && (
                  <div className="text-xs text-muted-foreground">
                    Last validated: {new Date(status.lastValidated).toLocaleString()}
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="text-sm font-medium">Sync Status</div>
                <div className="flex items-center gap-2">
                  <SyncIcon className={cn("h-4 w-4", syncInfo.color)} />
                  <span className="text-sm">{syncInfo.label}</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}