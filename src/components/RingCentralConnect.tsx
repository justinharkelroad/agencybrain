import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, CheckCircle, Loader2, RefreshCw, XCircle } from 'lucide-react';

interface VoipIntegration {
  id: string;
  provider: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_error: string | null;
  created_at: string;
}

export function RingCentralConnect() {
  const [integration, setIntegration] = useState<VoipIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchIntegration();

    // Handle OAuth callback params
    const rcConnected = searchParams.get('rc_connected');
    const rcError = searchParams.get('rc_error');

    if (rcConnected === 'true') {
      toast.success('RingCentral connected successfully!');
      // Clear the param
      searchParams.delete('rc_connected');
      setSearchParams(searchParams, { replace: true });
      fetchIntegration();
    }

    if (rcError) {
      const errorMessages: Record<string, string> = {
        missing_params: 'Missing OAuth parameters',
        invalid_state: 'Invalid state parameter',
        token_exchange_failed: 'Failed to exchange authorization code',
        database_error: 'Failed to save connection',
        config_error: 'RingCentral not configured',
        unexpected: 'An unexpected error occurred',
      };
      toast.error(`RingCentral connection failed: ${errorMessages[rcError] || rcError}`);
      // Clear the param
      searchParams.delete('rc_error');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  const fetchIntegration = async () => {
    try {
      const { data, error } = await supabase
        .from('voip_integrations')
        .select('*')
        .eq('provider', 'ringcentral')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setIntegration(data);
    } catch (error) {
      console.error('Error fetching RingCentral integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('ringcentral-oauth-init');

      if (error) throw error;

      if (!data?.auth_url) {
        throw new Error('No auth URL returned');
      }

      // Redirect to RingCentral OAuth
      window.location.href = data.auth_url;
    } catch (error: any) {
      console.error('Error initiating RingCentral connection:', error);
      toast.error(error.message || 'Failed to initiate connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect RingCentral? Call syncing will stop.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from('voip_integrations')
        .update({ is_active: false })
        .eq('provider', 'ringcentral');

      if (error) throw error;

      toast.success('RingCentral disconnected');
      fetchIntegration();
    } catch (error: any) {
      console.error('Error disconnecting RingCentral:', error);
      toast.error(error.message || 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      toast.info('Starting call sync...');

      const { data, error } = await supabase.functions.invoke('ringcentral-sync-calls');

      if (error) throw error;

      toast.success(`Sync complete! ${data?.calls_synced || 0} calls synced.`);
      fetchIntegration();
    } catch (error: any) {
      console.error('Error syncing calls:', error);
      toast.error(error.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = integration?.is_active;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
              <Phone className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <CardTitle>RingCentral</CardTitle>
              <CardDescription>Sync call logs for performance tracking</CardDescription>
            </div>
          </div>
          {isConnected && (
            <Badge className="bg-green-600 text-white border-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              {integration.last_sync_at ? (
                <p>
                  Last synced: {new Date(integration.last_sync_at).toLocaleString()}
                </p>
              ) : (
                <p>Never synced</p>
              )}
              {integration.last_sync_error && (
                <p className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3 w-3" />
                  {integration.last_sync_error}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSync}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Now
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your RingCentral account to automatically sync call logs and track team performance.
            </p>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Connect RingCentral
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
