import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Users, Eye, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AnalyticsData {
  totalViews: number;
  uniqueVisitors: number;
  submissions: number;
  conversionRate: number;
  recentActivity: any[];
  topReferrers: any[];
}

interface FormAnalyticsDashboardProps {
  formId: string;
  formName: string;
}

export function FormAnalyticsDashboard({ formId, formName }: FormAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [formId, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90));
      
      // Get form links for this form
      const { data: formLinks } = await supabase
        .from('form_links')
        .select('id')
        .eq('form_template_id', formId);
      
      if (!formLinks?.length) {
        setAnalytics({
          totalViews: 0,
          uniqueVisitors: 0,
          submissions: 0,
          conversionRate: 0,
          recentActivity: [],
          topReferrers: []
        });
        return;
      }
      
      const linkIds = formLinks.map(link => link.id);
      
      // Get analytics data
      const { data: analyticsData } = await supabase
        .from('form_link_analytics')
        .select('*')
        .in('form_link_id', linkIds)
        .gte('accessed_at', startDate.toISOString());
      
      // Get submissions data
      const { data: submissionsData } = await supabase
        .from('submissions')
        .select('id, submitted_at')
        .eq('form_template_id', formId)
        .gte('submitted_at', startDate.toISOString());
      
      if (analyticsData) {
        const totalViews = analyticsData.length;
        const uniqueVisitors = new Set(analyticsData.map(a => a.ip_address)).size;
        const submissions = submissionsData?.length || 0;
        const conversionRate = totalViews > 0 ? (submissions / totalViews) * 100 : 0;
        
        // Process recent activity
        const recentActivity = analyticsData
          .sort((a, b) => new Date(b.accessed_at).getTime() - new Date(a.accessed_at).getTime())
          .slice(0, 10);
        
        // Process top referrers
        const referrerCounts: Record<string, number> = {};
        analyticsData.forEach(a => {
          if (a.referer) {
            try {
              const domain = new URL(a.referer).hostname;
              referrerCounts[domain] = (referrerCounts[domain] || 0) + 1;
            } catch {
              referrerCounts['Direct'] = (referrerCounts['Direct'] || 0) + 1;
            }
          } else {
            referrerCounts['Direct'] = (referrerCounts['Direct'] || 0) + 1;
          }
        });
        
        const topReferrers = Object.entries(referrerCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([referrer, count]) => ({ referrer, count }));
        
        setAnalytics({
          totalViews,
          uniqueVisitors,
          submissions,
          conversionRate,
          recentActivity,
          topReferrers
        });
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Form Analytics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-8 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Analytics: {formName}</h2>
          <p className="text-muted-foreground">Form performance metrics and insights</p>
        </div>
        
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(range)}
            >
              {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
            </Button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Total Views</span>
            </div>
            <div className="text-2xl font-bold">{analytics.totalViews.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Unique Visitors</span>
            </div>
            <div className="text-2xl font-bold">{analytics.uniqueVisitors.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Submissions</span>
            </div>
            <div className="text-2xl font-bold">{analytics.submissions.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Conversion Rate</span>
            </div>
            <div className="text-2xl font-bold">{analytics.conversionRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Top Referrers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.recentActivity.length > 0 ? (
                analytics.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="flex-1">
                      <div className="text-sm">
                        Form accessed
                        {activity.form_submitted && (
                          <Badge variant="secondary" className="ml-2">Submitted</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(activity.accessed_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Top Referrers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topReferrers.length > 0 ? (
                analytics.topReferrers.map((referrer, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm">{referrer.referrer}</span>
                    <Badge variant="outline">{referrer.count}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No referrer data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}