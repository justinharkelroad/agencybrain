import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface ConflictWarningAlertProps {
  otherDevices: Array<{
    id: string;
    deviceFingerprint: string;
    lastHeartbeat: string;
    userAgent: string | null;
  }>;
}

export function ConflictWarningAlert({ otherDevices }: ConflictWarningAlertProps) {
  if (otherDevices.length === 0) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Multi-Device Edit Warning</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          This period is currently being edited on {otherDevices.length} other device{otherDevices.length > 1 ? 's' : ''}:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          {otherDevices.map((device) => (
            <li key={device.id}>
              Last active: {format(new Date(device.lastHeartbeat), 'h:mm a')}
              {device.userAgent && ` - ${device.userAgent.split(' ')[0]}`}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm font-medium">
          Save frequently to avoid losing your changes. The most recent save will override previous edits.
        </p>
      </AlertDescription>
    </Alert>
  );
}
