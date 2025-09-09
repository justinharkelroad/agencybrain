import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function RepairExplorer() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRepair = async () => {
    setIsRepairing(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: repairError } = await supabase.functions.invoke('repair_explorer_data');
      
      if (repairError) {
        setError(repairError.message);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Explorer Data Repair Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            This tool will scan for Explorer records with generic names like "Household 1" 
            and attempt to extract the real prospect names from the original form submissions.
          </div>

          <Button 
            onClick={handleRepair} 
            disabled={isRepairing}
            className="w-full"
          >
            {isRepairing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Repairing Data...
              </>
            ) : (
              'Start Data Repair'
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium">{result.message}</div>
                  <div className="text-sm">
                    • Records checked: {result.total_checked}
                  </div>
                  <div className="text-sm">
                    • Records repaired: {result.repaired}
                  </div>
                  {result.repaired_records && result.repaired_records.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium">Repaired records:</div>
                      <div className="text-xs space-y-1 mt-1">
                        {result.repaired_records.map((record: any, idx: number) => (
                          <div key={idx}>
                            "{record.old_name || 'NULL'}" → "{record.new_name}"
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}