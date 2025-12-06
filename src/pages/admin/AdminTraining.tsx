import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { TrainingContentTab, TrainingAssignmentsTab, TrainingProgressTab } from "./training-tabs";

export default function AdminTraining() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  
  const currentTab = searchParams.get('tab') || 'content';

  // Fetch agency ID
  useEffect(() => {
    async function fetchAgencyId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/dashboard');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (!profile?.agency_id) {
        navigate('/dashboard');
        return;
      }

      setAgencyId(profile.agency_id);
    }

    fetchAgencyId();
  }, [navigate]);

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  if (!agencyId) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Training System</h1>
        <p className="text-muted-foreground">Manage training content, assignments, and staff progress</p>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>
        
        <TabsContent value="content">
          <TrainingContentTab agencyId={agencyId} />
        </TabsContent>
        
        <TabsContent value="assignments">
          <TrainingAssignmentsTab agencyId={agencyId} />
        </TabsContent>
        
        <TabsContent value="progress">
          <TrainingProgressTab agencyId={agencyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
