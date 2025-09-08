import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TopNav } from "@/components/TopNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomFieldsManager } from "@/components/CustomFieldsManager";
import { toast } from "sonner";

export default function ProspectSettings() {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadAgencyData();
    }
  }, [user?.id]);

  const loadAgencyData = async () => {
    try {
      // Get user's agency
      const { data: profile } = await supa
        .from('profiles')
        .select('agency_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.agency_id) {
        toast.error('No agency found for user');
        return;
      }

      setAgencyId(profile.agency_id);
    } catch (error: any) {
      console.error('Error loading agency data:', error);
      toast.error('Failed to load agency information');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-muted-foreground">Please log in to access settings.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Prospect Settings</h1>
          <p className="text-muted-foreground">
            Configure custom fields and prospect management options
          </p>
        </div>

        <div className="space-y-6">
          <CustomFieldsManager agencyId={agencyId} />
          
          {/* Future: Add more prospect-related settings here */}
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Additional data management features coming soon.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}