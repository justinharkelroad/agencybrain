// Phase 3: Safe Backfill Utility for Quoted Details with Mappings
// Run after form templates have field_mappings configured

import { supabase } from '@/integrations/supabase/client';

interface BackfillResult {
  totalProcessed: number;
  beforeCounts: {
    totalRows: number;
    withItems: number;
    withPolicies: number;
    withPremium: number;
  };
  afterCounts: {
    totalRows: number;
    withItems: number;
    withPolicies: number;
    withPremium: number;
  };
  errors: string[];
}

/**
 * Safely backfill quoted_household_details using updated flattener with field mappings
 * Only runs for submissions from last 90 days with final=true
 * Includes before/after counts for verification
 */
export async function backfillQuotedDetailsWithMappings(): Promise<BackfillResult> {
  const result: BackfillResult = {
    totalProcessed: 0,
    beforeCounts: { totalRows: 0, withItems: 0, withPolicies: 0, withPremium: 0 },
    afterCounts: { totalRows: 0, withItems: 0, withPolicies: 0, withPremium: 0 },
    errors: []
  };

  try {
    // Get before counts for comparison
    const { data: beforeData, error: beforeError } = await supabase
      .from('quoted_household_details')
      .select('items_quoted, policies_quoted, premium_potential_cents')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (beforeError) {
      result.errors.push(`Error getting before counts: ${beforeError.message}`);
      return result;
    }

    result.beforeCounts = {
      totalRows: beforeData.length,
      withItems: beforeData.filter(r => r.items_quoted && r.items_quoted > 0).length,
      withPolicies: beforeData.filter(r => r.policies_quoted && r.policies_quoted > 0).length,
      withPremium: beforeData.filter(r => r.premium_potential_cents && r.premium_potential_cents > 0).length
    };

    // Get all final submissions from last 90 days with form templates that have mappings
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select(`
        id, 
        submission_date,
        form_templates!inner(
          id,
          field_mappings,
          agency_id
        )
      `)
      .eq('final', true)
      .gte('submission_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('submission_date', { ascending: false });

    if (submissionsError) {
      result.errors.push(`Error fetching submissions: ${submissionsError.message}`);
      return result;
    }

    console.log(`Found ${submissions?.length || 0} final submissions from last 90 days`);

    // Process submissions in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < (submissions?.length || 0); i += batchSize) {
      const batch = submissions!.slice(i, i + batchSize);
      
      for (const submission of batch) {
        try {
          // Call the enhanced flattener function for each submission
          const { error: flattenError } = await supabase.rpc('flatten_quoted_household_details', {
            p_submission: submission.id
          });

          if (flattenError) {
            result.errors.push(`Error processing submission ${submission.id}: ${flattenError.message}`);
            continue;
          }

          result.totalProcessed++;

          // Log progress every 25 submissions
          if (result.totalProcessed % 25 === 0) {
            console.log(`Processed ${result.totalProcessed} submissions...`);
          }

        } catch (error: any) {
          result.errors.push(`Exception processing submission ${submission.id}: ${error.message}`);
        }
      }

      // Small delay between batches to be gentle on the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Get after counts for comparison
    const { data: afterData, error: afterError } = await supabase
      .from('quoted_household_details')
      .select('items_quoted, policies_quoted, premium_potential_cents')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (afterError) {
      result.errors.push(`Error getting after counts: ${afterError.message}`);
      return result;
    }

    result.afterCounts = {
      totalRows: afterData.length,
      withItems: afterData.filter(r => r.items_quoted && r.items_quoted > 0).length,
      withPolicies: afterData.filter(r => r.policies_quoted && r.policies_quoted > 0).length,
      withPremium: afterData.filter(r => r.premium_potential_cents && r.premium_potential_cents > 0).length
    };

    console.log('Backfill completed successfully!');
    console.log('Before counts:', result.beforeCounts);
    console.log('After counts:', result.afterCounts);
    console.log(`Total processed: ${result.totalProcessed} submissions`);

    return result;

  } catch (error: any) {
    result.errors.push(`Backfill failed: ${error.message}`);
    return result;
  }
}

/**
 * Get sample rows before and after backfill for verification
 */
export async function getSampleRowsForVerification(limit: number = 5) {
  const { data, error } = await supabase
    .from('quoted_household_details')
    .select('household_name, items_quoted, policies_quoted, premium_potential_cents, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error getting sample rows:', error);
    return [];
  }

  return data;
}

/**
 * Get field mapping audit logs to verify mapping usage
 */
export async function getFieldMappingAuditLogs(limit: number = 10) {
  const { data, error } = await supabase
    .from('field_mapping_audit')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error getting audit logs:', error);
    return [];
  }

  return data;
}