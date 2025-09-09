import { useAgencyKpis } from "@/hooks/useKpis";

// Temporary test component to verify RPC function works
export function TestAgencyKpis() {
  const { data: kpis, isLoading, error } = useAgencyKpis('9cd307a0-0525-4323-8d5c-d829e4ce2643');

  if (isLoading) return <div>Loading KPIs...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="p-4 border rounded bg-muted/10">
      <h3 className="font-semibold mb-2">RPC Test: list_agency_kpis</h3>
      <p className="text-sm text-muted-foreground mb-2">
        Found {kpis?.length || 0} KPIs via RPC
      </p>
      {kpis?.map((kpi) => (
        <div key={kpi.kpi_id} className="text-xs">
          {kpi.label} ({kpi.slug}) - Active: {kpi.active ? 'Yes' : 'No'}
        </div>
      ))}
    </div>
  );
}