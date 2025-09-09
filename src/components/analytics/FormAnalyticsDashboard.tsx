import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, Users, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';

interface FormMetrics {
  totalSubmissions: number;
  uniqueUsers: number;
  completionRate: number;
  avgResponseTime: number;
  mostActiveForm: string;
  recentSubmissions: any[];
}

export function FormAnalyticsDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<FormMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Get user's agency first
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.agency_id) {
        setLoading(false);
        return;
      }

      // Fetch form submissions for this agency
      const { data: submissions, error } = await supabase
        .from('submissions')
        .select(`
          *,
          form_templates!inner(
            name,
            agency_id
          ),
          team_members(
            name,
            email
          )
        `)
        .eq('form_templates.agency_id', profile.agency_id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      // Process submissions to calculate metrics
      const uniqueUsers = new Set(submissions?.map(s => s.team_member_id) || []).size;
      const totalSubmissions = submissions?.length || 0;
      
      // Get form templates count for completion rate
      const { data: templates } = await supabase
        .from('form_templates')
        .select('id')
        .eq('agency_id', profile.agency_id);

      const completionRate = templates?.length ? (uniqueUsers / templates.length) * 100 : 0;

      // Calculate most active form
      const formCounts = submissions?.reduce((acc, sub) => {
        const formName = sub.form_templates?.name || 'Unknown';
        acc[formName] = (acc[formName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const mostActiveForm = Object.keys(formCounts).reduce((a, b) => 
        formCounts[a] > formCounts[b] ? a : b, 'None'
      );

      setMetrics({
        totalSubmissions,
        uniqueUsers,
        completionRate: Math.round(completionRate),
        avgResponseTime: 0, // Placeholder - would need to calculate from timestamps
        mostActiveForm,
        recentSubmissions: submissions?.slice(0, 5) || []
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent className="animate-pulse">
              <div className="h-8 bg-muted rounded w-1/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Form Analytics</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSubmissions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.uniqueUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.completionRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Active Form</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium truncate">{metrics.mostActiveForm}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
          <CardDescription>Latest form submissions from your team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.recentSubmissions.map((submission) => (
              <div key={submission.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{submission.form_templates?.name || 'Unknown Form'}</p>
                  <p className="text-sm text-muted-foreground">
                    by {submission.team_members?.name || 'Unknown User'}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={submission.final ? 'default' : 'secondary'}>
                    {submission.final ? 'Final' : 'Draft'}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(submission.submitted_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            {metrics.recentSubmissions.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No recent submissions</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}