import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEAssignmentsTab } from "./sales-experience-tabs/SEAssignmentsTab";
import { SEContentTab } from "./sales-experience-tabs/SEContentTab";
import { SEAnalyticsTab } from "./sales-experience-tabs/SEAnalyticsTab";
import { SEMessagesTab } from "./sales-experience-tabs/SEMessagesTab";

export default function AdminSalesExperience() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'assignments';

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          <SEAssignmentsTab />
        </TabsContent>

        <TabsContent value="content">
          <SEContentTab />
        </TabsContent>

        <TabsContent value="messages">
          <SEMessagesTab />
        </TabsContent>

        <TabsContent value="analytics">
          <SEAnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
