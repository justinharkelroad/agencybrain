import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RunRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRepair = async () => {
    setIsRepairing(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('repair_explorer_data', {});
      
      if (fnError) throw fnError;
      
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred');
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Explorer Data Repair Tool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            This tool will fix prospect names in the Explorer data by extracting them from submission payloads.
          </p>
          
          <Button 
            onClick={handleRepair} 
            disabled={isRepairing}
            className="w-full"
          >
            {isRepairing ? 'Repairing...' : 'Run Repair'}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Status:</strong> {result.message}</p>
                  <p><strong>Records Checked:</strong> {result.total_checked}</p>
                  <p><strong>Records Repaired:</strong> {result.repaired}</p>
                  {result.repaired_records && result.repaired_records.length > 0 && (
                    <div>
                      <p><strong>Repairs Made:</strong></p>
                      <ul className="list-disc list-inside ml-4">
                        {result.repaired_records.map((r: any) => (
                          <li key={r.id}>
                            "{r.old_name}" → "{r.new_name}"
                          </li>
                        ))}
                      </ul>
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