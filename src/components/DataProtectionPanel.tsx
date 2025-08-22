import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Download, Upload, Archive, CheckCircle, AlertTriangle, Clock, Database } from "lucide-react";
import { useDataProtection, type DataProtectionStatus } from "@/hooks/useDataProtection";
import { type CellAddr } from "../bonus_grid_web_spec/computeWithRounding";

interface DataProtectionPanelProps {
  gridData: Record<CellAddr, any>;
  onDataImported: (data: Record<CellAddr, any>) => void;
}

export function DataProtectionPanel({ gridData, onDataImported }: DataProtectionPanelProps) {
  const {
    status,
    createBackup,
    exportData,
    importData,
    getBackups,
    restoreBackup,
    checkIntegrity,
    toggleAutoBackup
  } = useDataProtection(gridData);

  const handleImport = async () => {
    const importedData = await importData();
    if (importedData) {
      onDataImported(importedData);
    }
  };

  const handleRestore = (timestamp: string) => {
    const restoredData = restoreBackup(timestamp);
    if (restoredData) {
      onDataImported(restoredData);
    }
  };

  const backups = getBackups();

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Data Protection</h2>
        <Badge variant={status.isHealthy ? "default" : "destructive"}>
          {status.isHealthy ? "Healthy" : "Issues Detected"}
        </Badge>
      </div>

      {!status.isHealthy && status.integrityReport && (
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {status.integrityReport.criticalIssues.length > 0 ? (
              <>Critical data issues detected: {status.integrityReport.criticalIssues.join(', ')}</>
            ) : (
              <>Data validation warnings found. Check integrity report for details.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="backup" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <TabsContent value="backup" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-medium">Create Backups</h3>
              <p className="text-sm text-muted-foreground">
                Protect your data with manual and automatic backups
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createBackup()} variant="outline" size="sm">
                <Archive className="h-4 w-4 mr-2" />
                Create Backup
              </Button>
              <Button onClick={exportData} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export to File
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Auto-backup every 30 seconds</span>
            </div>
            <Button
              onClick={() => toggleAutoBackup(!status.autoBackupEnabled)}
              variant={status.autoBackupEnabled ? "default" : "outline"}
              size="sm"
            >
              {status.autoBackupEnabled ? "Enabled" : "Disabled"}
            </Button>
          </div>

          {status.lastBackup && (
            <p className="text-xs text-muted-foreground">
              Last backup: {new Date(status.lastBackup).toLocaleString()}
            </p>
          )}
        </TabsContent>

        <TabsContent value="recovery" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-medium">Data Recovery</h3>
              <p className="text-sm text-muted-foreground">
                Restore from backups or import external data
              </p>
            </div>
            <Button onClick={handleImport} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import from File
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Backups ({backups.length})</h4>
            {backups.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No backups available</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {backups.slice(0, 10).map((backup) => (
                  <div
                    key={backup.metadata.timestamp}
                    className="flex items-center justify-between p-2 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-medium">
                        {new Date(backup.metadata.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {backup.metadata.source} • {backup.metadata.dataSize} fields
                      </p>
                    </div>
                    <Button
                      onClick={() => handleRestore(backup.metadata.timestamp)}
                      variant="ghost"
                      size="sm"
                    >
                      Restore
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">System Health</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {status.isHealthy ? "Healthy" : "Issues"}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Backup Count</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{status.backupCount}</p>
            </div>
          </div>

          {status.integrityReport && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Data Integrity Report</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs">Validation Status</span>
                  <Badge variant={status.integrityReport.validation.isValid ? "default" : "destructive"}>
                    {status.integrityReport.validation.isValid ? "Valid" : "Invalid"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs">Data Completeness</span>
                  <span className="text-xs font-medium">
                    {Math.round(status.integrityReport.validation.completeness * 100)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs">Required Fields</span>
                  <Badge variant={status.integrityReport.hasRequiredFields ? "default" : "destructive"}>
                    {status.integrityReport.hasRequiredFields ? "Complete" : "Missing"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs">Data Size</span>
                  <span className="text-xs font-medium">{status.integrityReport.dataSize} fields</span>
                </div>
              </div>

              {status.integrityReport.validation.errors.length > 0 && (
                <div className="space-y-1">
                  <h5 className="text-xs font-medium text-destructive">Errors:</h5>
                  {status.integrityReport.validation.errors.map((error, i) => (
                    <p key={i} className="text-xs text-destructive">{error}</p>
                  ))}
                </div>
              )}

              {status.integrityReport.validation.warnings.length > 0 && (
                <div className="space-y-1">
                  <h5 className="text-xs font-medium text-yellow-600">Warnings:</h5>
                  {status.integrityReport.validation.warnings.map((warning, i) => (
                    <p key={i} className="text-xs text-yellow-600">{warning}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button onClick={() => checkIntegrity()} variant="outline" size="sm" className="w-full">
            <Shield className="h-4 w-4 mr-2" />
            Run Integrity Check
          </Button>
        </TabsContent>
      </Tabs>
    </Card>
  );
}