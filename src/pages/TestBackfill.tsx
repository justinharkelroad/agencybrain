import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function TestBackfill() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [verification, setVerification] = useState<any>(null);
  const { toast } = useToast();

  const runBackfill = async () => {
    setLoading(true);
    setResults(null);
    setVerification(null);

    try {
      // Get before state
      const { data: beforeSummary } = await supabase
        .from("vw_flattening_summary")
        .select("*")
        .single();

      console.log("Before backfill:", beforeSummary);

      // Call the backfill function
      const { data, error } = await supabase.functions.invoke("run_backfill", {
        body: {} // No specific submission_ids = process all failed
      });

      if (error) {
        console.error("Backfill error:", error);
        toast({
          title: "Backfill Failed",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      console.log("Backfill results:", data);

      // Get after state
      const { data: afterSummary } = await supabase
        .from("vw_flattening_summary")
        .select("*")
        .single();

      // Check James Toney's submission
      const { data: jamesToney } = await supabase
        .from("quoted_household_details")
        .select("id, household_name, lead_source_label, items_quoted, policies_quoted, premium_potential_cents, extras")
        .eq("submission_id", "19ebc10a-6906-41c2-b786-82a300fbc890");

      // Get sample of new records
      const { data: sampleRecords } = await supabase
        .from("quoted_household_details")
        .select("id, household_name, lead_source_label, items_quoted, policies_quoted, premium_potential_cents, extras, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      setResults(data);
      setVerification({
        before: beforeSummary,
        after: afterSummary,
        jamesToney,
        sampleRecords
      });

      toast({
        title: "Backfill Complete",
        description: `Processed ${data.processed} submissions successfully, ${data.errors} errors`
      });

    } catch (err: any) {
      console.error("Error:", err);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Backfill Function</CardTitle>
          <CardDescription>
            Run the backfill to process all failed flattenings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runBackfill} 
            disabled={loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Run Backfill
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Backfill Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Total Submissions:</strong> {results.total}</p>
              <p><strong>Successfully Processed:</strong> {results.processed}</p>
              <p><strong>Errors:</strong> {results.errors}</p>
              
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Detailed Results:</h4>
                <div className="max-h-96 overflow-y-auto">
                  <pre className="text-xs bg-muted p-4 rounded">
                    {JSON.stringify(results.results, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {verification && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Before/After Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Before</h4>
                  <pre className="text-xs bg-muted p-4 rounded">
                    {JSON.stringify(verification.before, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">After</h4>
                  <pre className="text-xs bg-muted p-4 rounded">
                    {JSON.stringify(verification.after, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>James Toney's Submission</CardTitle>
            </CardHeader>
            <CardContent>
              {verification.jamesToney && verification.jamesToney.length > 0 ? (
                <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
                  {JSON.stringify(verification.jamesToney, null, 2)}
                </pre>
              ) : (
                <p className="text-destructive">Not found in quoted_household_details</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sample New Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <pre className="text-xs bg-muted p-4 rounded">
                  {JSON.stringify(verification.sampleRecords, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
