import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onForceSave: () => void;
  onCancel: () => void;
  otherDevices: Array<{
    id: string;
    deviceFingerprint: string;
    lastHeartbeat: string;
    userAgent: string | null;
  }>;
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  onForceSave,
  onCancel,
  otherDevices,
}: ConflictResolutionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Save Conflict Detected</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-4">
            <p>
              This period is currently being edited on {otherDevices.length} other device
              {otherDevices.length > 1 ? 's' : ''}:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              {otherDevices.map((device) => (
                <li key={device.id}>
                  Last active: {format(new Date(device.lastHeartbeat), 'h:mm a')}
                  {device.userAgent && ` - ${device.userAgent.split(' ')[0]}`}
                </li>
              ))}
            </ul>
            <p className="font-medium">
              If you continue, your changes will overwrite any edits made on the other device(s).
            </p>
            <p className="text-sm text-muted-foreground">
              Consider coordinating with the other session before saving to avoid losing work.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onForceSave} className="bg-destructive hover:bg-destructive/90">
            Save Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
