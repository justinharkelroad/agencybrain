import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SEAssignmentsTab } from "./sales-experience-tabs/SEAssignmentsTab";
import { SEContentTab } from "./sales-experience-tabs/SEContentTab";
import { SETranscriptsTab } from "./sales-experience-tabs/SETranscriptsTab";
import { SEAnalyticsTab } from "./sales-experience-tabs/SEAnalyticsTab";
import { SEMessagesTab } from "./sales-experience-tabs/SEMessagesTab";
import { SEPromptsTab } from "./sales-experience-tabs/SEPromptsTab";
import { SETemplatesTab } from "./sales-experience-tabs/SETemplatesTab";
import { useSalesExperienceAdminUnreadMessages } from "@/hooks/useSalesExperienceUnread";

export default function AdminSalesExperience() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'assignments';
  const { data: adminUnreadCount = 0 } = useSalesExperienceAdminUnreadMessages();

  const handleTabChange = (value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', value);
      return next;
    }, { replace: true });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">8-Week Sales Experience Admin</h1>
        <p className="text-muted-foreground">
          Manage assignments, content, and track participant progress
        </p>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            Messages
            {adminUnreadCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center text-xs px-1">
                {adminUnreadCount > 99 ? '99+' : adminUnreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="prompts">AI Prompts</TabsTrigger>
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          <SEAssignmentsTab />
        </TabsContent>

        <TabsContent value="content">
          <SEContentTab />
        </TabsContent>

        <TabsContent value="transcripts">
          <SETranscriptsTab />
        </TabsContent>

        <TabsContent value="messages">
          <SEMessagesTab />
        </TabsContent>

        <TabsContent value="prompts">
          <SEPromptsTab />
        </TabsContent>

        <TabsContent value="templates">
          <SETemplatesTab />
        </TabsContent>

        <TabsContent value="analytics">
          <SEAnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
