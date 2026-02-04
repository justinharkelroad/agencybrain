import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AutoFieldMappingSetup } from "@/components/AutoFieldMappingSetup";

export default function FieldMappingSetup() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const force = searchParams.get("setup") === "1";
  const isAdmin = user?.role === "admin";

  if (!isAdmin && !force) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground">Access Denied</h1>
          <p className="text-muted-foreground mt-2">Only administrators can access this setup page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Field Mapping Setup *</h1>
          <p className="text-muted-foreground mt-2">
            Configure field mappings and backfill data for proper dashboard and explorer functionality.
          </p>
        </div>
        
        <AutoFieldMappingSetup />
      </div>
    </div>
  );
}