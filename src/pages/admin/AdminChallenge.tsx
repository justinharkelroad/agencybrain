import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChallengeContentTab } from "./challenge-tabs/ChallengeContentTab";
import { ChallengeAssignmentsTab } from "./challenge-tabs/ChallengeAssignmentsTab";
import { ChallengeAnalyticsTab } from "./challenge-tabs/ChallengeAnalyticsTab";

export default function AdminChallenge() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'content';

  const handleTabChange = (value: string) => {
    // Preserve existing URL params when changing tabs
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', value);
      return next;
    }, { replace: true });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">6-Week Challenge Admin</h1>
        <p className="text-muted-foreground">Manage challenge content, assignments, and track participant progress</p>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="content">
          <ChallengeContentTab />
        </TabsContent>
        
        <TabsContent value="assignments">
          <ChallengeAssignmentsTab />
        </TabsContent>
        
        <TabsContent value="analytics">
          <ChallengeAnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
