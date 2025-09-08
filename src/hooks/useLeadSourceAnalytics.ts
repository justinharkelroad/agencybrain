import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface LeadSourceMetrics {
  name: string;
  totalLeads: number;
  quotedLeads: number;
  soldItems: number;
  soldPolicies: number;
  premiumSold: number; // in cents
  conversionRate: number;
  quoteRate: number;
  costPerLead: number; // in cents
  costPerQuote: number; // in cents
  costPerSale: number; // in cents
  roi: number;
  revenuePerLead: number; // in cents
  totalSpend: number; // in cents
}

interface AnalyticsSummary {
  leadSources: LeadSourceMetrics[];
  totals: {
    totalLeads: number;
    quotedLeads: number;
    soldItems: number;
    soldPolicies: number;
    totalRevenue: number; // in cents
    totalSpend: number; // in cents
    overallConversionRate: number;
    overallQuoteRate: number;
    overallROI: number;
  };
}

export function useLeadSourceAnalytics(startDate: string, endDate: string) {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get user's agency
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (!profile?.agency_id) {
        setAnalytics(null);
        setLoading(false);
        return;
      }

      // Get lead sources for this agency
      const { data: leadSources } = await supabase
        .from('lead_sources')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .eq('is_active', true);

      if (!leadSources?.length) {
        setAnalytics({
          leadSources: [],
          totals: {
            totalLeads: 0,
            quotedLeads: 0,
            soldItems: 0,
            soldPolicies: 0,
            totalRevenue: 0,
            totalSpend: 0,
            overallConversionRate: 0,
            overallQuoteRate: 0,
            overallROI: 0,
          }
        });
        setLoading(false);
        return;
      }

      // Get submissions within date range for this agency
      const { data: submissions } = await supabase
        .from('submissions')
        .select(`
          *,
          form_templates!inner(agency_id),
          quoted_households(
            *,
            quoted_household_details(*)
          )
        `)
        .eq('form_templates.agency_id', profile.agency_id)
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .eq('final', true);

      // Get prospect overrides within date range
      const { data: overrides } = await supabase
        .from('prospect_overrides')
        .select(`
          *,
          lead_sources(name)
        `)
        .eq('agency_id', profile.agency_id)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Process analytics
      const leadSourceMap = new Map<string, LeadSourceMetrics>();

      // Initialize lead source metrics
      leadSources.forEach(ls => {
        leadSourceMap.set(ls.name, {
          name: ls.name,
          totalLeads: 0,
          quotedLeads: 0,
          soldItems: 0,
          soldPolicies: 0,
          premiumSold: 0,
          conversionRate: 0,
          quoteRate: 0,
          costPerLead: ls.cost_per_lead_cents || 0,
          costPerQuote: 0,
          costPerSale: 0,
          roi: 0,
          revenuePerLead: 0,
          totalSpend: 0,
        });
      });

        // Process submissions data
        submissions?.forEach(submission => {
          const payload = submission.payload_json as any || {}; // Type assertion for JSON data
          const quotedCount = parseInt(payload.quoted_count) || 0;
          const soldItems = parseInt(payload.sold_items) || 0;
          const soldPolicies = parseInt(payload.sold_policies) || 0;
          const soldPremium = parseInt(payload.sold_premium_cents) || 0;

        // Process quoted households
        submission.quoted_households?.forEach((qh: any) => {
          const leadSourceName = qh.lead_source || 'Unknown';
          const metrics = leadSourceMap.get(leadSourceName);
          
          if (metrics) {
            // Count quoted households as leads
            qh.quoted_household_details?.forEach((detail: any) => {
              metrics.totalLeads++;
              metrics.quotedLeads++;
              
              // If this submission has sold items, attribute proportionally
              if (soldItems > 0) {
                metrics.soldItems += soldItems / (submission.quoted_households?.length || 1);
                metrics.soldPolicies += soldPolicies / (submission.quoted_households?.length || 1);
                metrics.premiumSold += soldPremium / (submission.quoted_households?.length || 1);
              }
            });
          }
        });
      });

      // Process prospect overrides
      overrides?.forEach(override => {
        const leadSourceName = override.lead_sources?.name || override.lead_source_raw || 'Unknown';
        const metrics = leadSourceMap.get(leadSourceName);
        
        if (metrics) {
          metrics.totalLeads++;
          if (override.items_quoted && override.items_quoted > 0) {
            metrics.quotedLeads++;
          }
          if (override.items_quoted) {
            metrics.soldItems += override.items_quoted || 0;
          }
          if (override.policies_quoted) {
            metrics.soldPolicies += override.policies_quoted || 0;
          }
          if (override.premium_potential_cents) {
            metrics.premiumSold += override.premium_potential_cents || 0;
          }
        }
      });

      // Calculate derived metrics
      const leadSourceMetrics: LeadSourceMetrics[] = [];
      let totalLeads = 0;
      let totalQuotedLeads = 0;
      let totalSoldItems = 0;
      let totalSoldPolicies = 0;
      let totalRevenue = 0;
      let totalSpend = 0;

      leadSourceMap.forEach(metrics => {
        // Calculate spend based on leads and cost per lead
        metrics.totalSpend = metrics.totalLeads * metrics.costPerLead;
        
        // Calculate rates
        metrics.quoteRate = metrics.totalLeads > 0 ? Math.round((metrics.quotedLeads / metrics.totalLeads) * 100) : 0;
        metrics.conversionRate = metrics.quotedLeads > 0 ? Math.round((metrics.soldItems / metrics.quotedLeads) * 100) : 0;
        
        // Calculate costs
        metrics.costPerQuote = metrics.quotedLeads > 0 ? Math.round(metrics.totalSpend / metrics.quotedLeads) : 0;
        metrics.costPerSale = metrics.soldItems > 0 ? Math.round(metrics.totalSpend / metrics.soldItems) : 0;
        
        // Calculate ROI
        metrics.roi = metrics.totalSpend > 0 ? Math.round(((metrics.premiumSold - metrics.totalSpend) / metrics.totalSpend) * 100) : 0;
        
        // Calculate revenue per lead
        metrics.revenuePerLead = metrics.totalLeads > 0 ? Math.round(metrics.premiumSold / metrics.totalLeads) : 0;

        // Add to totals
        totalLeads += metrics.totalLeads;
        totalQuotedLeads += metrics.quotedLeads;
        totalSoldItems += metrics.soldItems;
        totalSoldPolicies += metrics.soldPolicies;
        totalRevenue += metrics.premiumSold;
        totalSpend += metrics.totalSpend;

        // Only include lead sources with data
        if (metrics.totalLeads > 0) {
          leadSourceMetrics.push(metrics);
        }
      });

      // Sort by revenue descending
      leadSourceMetrics.sort((a, b) => b.premiumSold - a.premiumSold);

      const overallQuoteRate = totalLeads > 0 ? Math.round((totalQuotedLeads / totalLeads) * 100) : 0;
      const overallConversionRate = totalQuotedLeads > 0 ? Math.round((totalSoldItems / totalQuotedLeads) * 100) : 0;
      const overallROI = totalSpend > 0 ? Math.round(((totalRevenue - totalSpend) / totalSpend) * 100) : 0;

      setAnalytics({
        leadSources: leadSourceMetrics,
        totals: {
          totalLeads,
          quotedLeads: totalQuotedLeads,
          soldItems: Math.round(totalSoldItems),
          soldPolicies: Math.round(totalSoldPolicies),
          totalRevenue,
          totalSpend,
          overallConversionRate,
          overallQuoteRate,
          overallROI,
        }
      });

    } catch (error: any) {
      console.error('Error fetching lead source analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [user?.id, startDate, endDate]);

  return {
    analytics,
    loading,
    refetch: fetchAnalytics,
  };
}