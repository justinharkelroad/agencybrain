import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { TrainingContentTab, TrainingAssignmentsTab, TrainingProgressTab, StaffUsersTab, SPAssignmentsTab } from "./training-tabs";

// Session storage key for caching agencyId to survive component remounts
const AGENCY_ID_CACHE_KEY = 'training_page_agency_id';

export default function AdminTraining() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize from sessionStorage to survive remounts caused by auth state changes
  const [agencyId, setAgencyId] = useState<string | null>(() => {
    return sessionStorage.getItem(AGENCY_ID_CACHE_KEY);
  });

  const currentTab = searchParams.get('tab') || 'content';

  // Fetch agency ID - skip if we already have a cached value
  useEffect(() => {
    // If we already have agencyId from cache, validate it's still correct
    // but don't block rendering
    async function fetchAgencyId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        sessionStorage.removeItem(AGENCY_ID_CACHE_KEY);
        navigate('/dashboard');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      let resolvedAgencyId = profile?.agency_id || null;

      // Key employee fallback: resolve agency from key_employees table
      if (!resolvedAgencyId) {
        const { data: keyEmployee } = await supabase
          .from('key_employees')
          .select('agency_id')
          .eq('user_id', user.id)
          .maybeSingle();

        resolvedAgencyId = keyEmployee?.agency_id || null;
      }

      if (!resolvedAgencyId) {
        sessionStorage.removeItem(AGENCY_ID_CACHE_KEY);
        navigate('/dashboard');
        return;
      }

      // Cache in sessionStorage for remounts
      sessionStorage.setItem(AGENCY_ID_CACHE_KEY, resolvedAgencyId);
      setAgencyId(resolvedAgencyId);
    }

    fetchAgencyId();
  }, [navigate]);

  const handleTabChange = (value: string) => {
    // Preserve existing URL params (categoryId, moduleId, editLessonId) when changing tabs
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', value);
      return next;
    }, { replace: true });
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="sp-assignments">SP Assignments</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="staff">Staff Users</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <TrainingContentTab agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="assignments">
          <TrainingAssignmentsTab agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="sp-assignments">
          <SPAssignmentsTab agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="progress">
          <TrainingProgressTab agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="staff">
          <StaffUsersTab agencyId={agencyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
