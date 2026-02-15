import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check, AlertTriangle, ExternalLink } from 'lucide-react';

interface Credential {
  name: string;
  username: string;
  password: string;
}

interface CredentialDisplayProps {
  credentials: Credential[];
  staffLoginUrl?: string;
  showEmailWarning?: boolean;
}

export function CredentialDisplay({
  credentials,
  staffLoginUrl = `${window.location.origin}/staff/login`,
  showEmailWarning = true,
}: CredentialDisplayProps) {
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopyRow = async (index: number) => {
    const cred = credentials[index];
    const text = `Name: ${cred.name}\nUsername: ${cred.username}\nPassword: ${cred.password}`;
    await navigator.clipboard.writeText(text);
    setCopiedRow(index);
    setTimeout(() => setCopiedRow(null), 2000);
  };

  const handleCopyAll = async () => {
    const text = credentials
      .map((cred, i) => `${cred.name}\n  Username: ${cred.username}\n  Password: ${cred.password}`)
      .join('\n\n');
    const fullText = `Staff Login URL: ${staffLoginUrl}\n\n${text}`;
    await navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(staffLoginUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (credentials.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Team Login Credentials</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            className="gap-2"
          >
            {copiedAll ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedAll ? 'Copied!' : 'Copy All'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Staff Login URL */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Staff Login URL</p>
            <p className="text-sm font-mono truncate">{staffLoginUrl}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleCopyUrl}
          >
            {copiedUrl ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Credentials Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Username</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Password</th>
                <th className="py-2 px-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((cred, index) => (
                <tr key={index} className="border-b last:border-0">
                  <td className="py-2 px-3">{cred.name}</td>
                  <td className="py-2 px-3">
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                      {cred.username}
                    </code>
                  </td>
                  <td className="py-2 px-3">
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                      {cred.password}
                    </code>
                  </td>
                  <td className="py-2 px-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleCopyRow(index)}
                    >
                      {copiedRow === index ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Email Warning */}
        {showEmailWarning && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Credential emails may be delayed
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Corporate email filters (especially Allstate) often block automated emails. Share credentials from this screen directly with your team.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
