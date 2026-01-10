import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrainingContentTab } from '@/pages/admin/training-tabs/TrainingContentTab';
import { TrainingAssignmentsTab } from '@/pages/admin/training-tabs/TrainingAssignmentsTab';
import { TrainingProgressTab } from '@/pages/admin/training-tabs/TrainingProgressTab';
import { StaffUsersTab } from '@/pages/admin/training-tabs/StaffUsersTab';
import { useStaffAuth } from '@/hooks/useStaffAuth';

export default function StaffTrainingManagement() {
  const navigate = useNavigate();
  const { user, loading } = useStaffAuth();
  const [activeTab, setActiveTab] = useState('content');

  // Get agency ID from staff user
  const agencyId = user?.agency_id;

  // Check if user is a manager
  useEffect(() => {
    if (!loading && user) {
      if (user.role !== 'Manager') {
        navigate('/staff/dashboard');
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agencyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          Unable to load agency information. Please try logging in again.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Training Management</h1>
        <p className="text-muted-foreground">Create and manage training content for your team</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="staff">Staff Users</TabsTrigger>
        </TabsList>
        
        <TabsContent value="content" className="space-y-4">
          <TrainingContentTab agencyId={agencyId} />
        </TabsContent>
        
        <TabsContent value="assignments" className="space-y-4">
          <TrainingAssignmentsTab agencyId={agencyId} />
        </TabsContent>
        
        <TabsContent value="progress" className="space-y-4">
          <TrainingProgressTab agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <StaffUsersTab agencyId={agencyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
