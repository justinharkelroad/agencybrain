import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

type BundledStatus = 'yes' | 'no' | 'n/a';

interface ParsedRenewalRecord {
  policyNumber: string;
  renewalEffectiveDate: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  phoneAlt: string | null;
  productName: string | null;
  productCode: string | null;
  originalYear: number | null;
  agentNumber: string | null;
  renewalStatus: string | null;
  accountType: string | null;
  premiumOld: number | null;
  premiumNew: number | null;
  premiumChangeDollars: number | null;
  premiumChangePercent: number | null;
  amountDue: number | null;
  easyPay: boolean;
  multiLineIndicator: BundledStatus;
  itemCount: number | null;
  yearsPriorInsurance: number | null;
  householdKey: string | null;
  carrierStatus: string | null;
  zipCode: string | null;
  city: string | null;
  state: string | null;
}

const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionToken = req.headers.get('x-staff-session');
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: 'Missing staff session token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate staff session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at')
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (sessionError || !session) {
      console.error('Session lookup error:', sessionError);
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Session expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get staff user details
    const { data: staffUser, error: userError } = await supabase
      .from('staff_users')
      .select('id, agency_id, display_name, is_active')
      .eq('id', session.staff_user_id)
      .single();

    if (userError || !staffUser) {
      console.error('Staff user lookup error:', userError);
      return new Response(JSON.stringify({ error: 'Staff user not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify staff user is active
    if (!staffUser.is_active) {
      console.error('Staff user is not active');
      return new Response(JSON.stringify({ error: 'User account is not active' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { records, filename } = await req.json() as {
      records: ParsedRenewalRecord[];
      filename: string;
    };

    if (!records || !Array.isArray(records) || records.length === 0) {
      return new Response(JSON.stringify({ error: 'No records provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${records.length} renewal records for agency ${staffUser.agency_id}`);

    // Calculate date range from records
    const dates = records
      .map(r => r.renewalEffectiveDate)
      .filter(Boolean)
      .sort();
    const dateRangeStart = dates[0] || null;
    const dateRangeEnd = dates[dates.length - 1] || null;

    // Create upload record
    const { data: upload, error: uploadError } = await supabase
      .from('renewal_uploads')
      .insert({
        agency_id: staffUser.agency_id,
        filename,
        uploaded_by: staffUser.id,
        uploaded_by_display_name: staffUser.display_name,
        record_count: records.length,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
      })
      .select()
      .single();

    if (uploadError) {
      console.error('Failed to create upload record:', uploadError);
      throw uploadError;
    }

    console.log(`Created upload record: ${upload.id}`);

    // Deactivate existing active records in the date range (mark as "dropped")
    let deactivatedCount = 0;
    let autoPromotedCount = 0;
    if (dateRangeStart && dateRangeEnd) {
      const { data: deactivated, error: deactivateError } = await supabase
        .from('renewal_records')
        .update({
          is_active: false,
          dropped_from_report_at: new Date().toISOString(),
        })
        .eq('agency_id', staffUser.agency_id)
        .eq('is_active', true)
        .gte('renewal_effective_date', dateRangeStart)
        .lte('renewal_effective_date', dateRangeEnd)
        .select('id');

      if (deactivateError) {
        console.error('Deactivation error:', deactivateError);
      } else {
        deactivatedCount = deactivated?.length || 0;
        console.log(`Deactivated ${deactivatedCount} existing records in date range ${dateRangeStart} to ${dateRangeEnd}`);
      }

    }

    let newCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // Process in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, Math.min(i + BATCH_SIZE, records.length));
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}, records ${i + 1}-${i + batch.length}`);

      // Get all policy numbers in this batch to check existing records
      const policyKeys = batch.map(r => ({
        policy_number: r.policyNumber,
        renewal_effective_date: r.renewalEffectiveDate,
      }));

      // Check which records already exist (no is_active filter — records may have been deactivated above)
      const { data: existingRecords, error: existingError } = await supabase
        .from('renewal_records')
        .select('id, policy_number, renewal_effective_date')
        .eq('agency_id', staffUser.agency_id)
        .in('policy_number', policyKeys.map(k => k.policy_number));

      if (existingError) {
        console.error('Error checking existing records:', existingError);
      }

      // Create a map for quick lookup
      const existingMap = new Map<string, string>();
      if (existingRecords) {
        for (const rec of existingRecords) {
          const key = `${rec.policy_number}|${rec.renewal_effective_date}`;
          existingMap.set(key, rec.id);
        }
      }

      // Separate into inserts and updates
      const toInsert: any[] = [];
      const toUpdate: { id: string; data: any }[] = [];

      for (const r of batch) {
        const key = `${r.policyNumber}|${r.renewalEffectiveDate}`;
        const existingId = existingMap.get(key);

        const recordData = {
          first_name: r.firstName,
          last_name: r.lastName,
          email: r.email,
          phone: r.phone,
          phone_alt: r.phoneAlt,
          product_name: r.productName,
          product_code: r.productCode,
          original_year: r.originalYear,
          agent_number: r.agentNumber,
          renewal_status: r.renewalStatus,
          account_type: r.accountType,
          premium_old: r.premiumOld,
          premium_new: r.premiumNew,
          premium_change_dollars: r.premiumChangeDollars,
          premium_change_percent: r.premiumChangePercent,
          amount_due: r.amountDue,
          easy_pay: r.easyPay,
          multi_line_indicator: r.multiLineIndicator,
          item_count: r.itemCount,
          years_prior_insurance: r.yearsPriorInsurance,
          household_key: r.householdKey,
          carrier_status: r.carrierStatus,
          zip_code: r.zipCode,
          city: r.city,
          state: r.state,
          last_upload_id: upload.id,
          updated_at: new Date().toISOString(),
        };

        if (existingId) {
          toUpdate.push({ id: existingId, data: { ...recordData, is_active: true, dropped_from_report_at: null } });
        } else {
          toInsert.push({
            agency_id: staffUser.agency_id,
            upload_id: upload.id,
            policy_number: r.policyNumber,
            renewal_effective_date: r.renewalEffectiveDate,
            ...recordData,
            uploaded_by: staffUser.id,
            uploaded_by_display_name: staffUser.display_name,
            current_status: 'uncontacted',
            is_active: true,
          });
        }
      }

      // Batch insert new records
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('renewal_records')
          .insert(toInsert);

        if (insertError) {
          console.error('Batch insert error:', insertError);
          errorCount += toInsert.length;
        } else {
          newCount += toInsert.length;
        }
      }

      // Batch update existing records (have to do individually due to different IDs)
      for (const { id, data } of toUpdate) {
        const { error: updateError } = await supabase
          .from('renewal_records')
          .update(data)
          .eq('id', id);

        if (updateError) {
          console.error(`Update error for ${id}:`, updateError);
          errorCount++;
        } else {
          updatedCount++;
        }
      }
    }

    console.log(`Upload complete: ${newCount} new, ${updatedCount} updated, ${errorCount} errors`);

    // Records that were deactivated but not reactivated are truly "dropped"
    const droppedCount = Math.max(0, deactivatedCount - updatedCount);
    console.log(`Dropped records: ${droppedCount} (deactivated ${deactivatedCount} - reactivated ${updatedCount})`);

    // Auto-promote dropped records that were already "Renewal Taken" to success.
    // MUST run AFTER batch processing so reactivated records (is_active=true,
    // dropped_from_report_at=null) don't get incorrectly promoted.
    if (dateRangeStart && dateRangeEnd) {
      const { data: autoPromoted, error: autoPromoteError } = await supabase
        .from('renewal_records')
        .update({
          current_status: 'success',
          auto_resolved_reason: 'renewal_taken_dropped',
          updated_at: new Date().toISOString(),
        })
        .eq('agency_id', staffUser.agency_id)
        .eq('is_active', false)
        .not('dropped_from_report_at', 'is', null)
        .eq('renewal_status', 'Renewal Taken')
        .in('current_status', ['uncontacted', 'pending'])
        .select('id');

      if (autoPromoteError) {
        console.error('Auto-promote error:', autoPromoteError);
      } else {
        autoPromotedCount = autoPromoted?.length || 0;
        if (autoPromotedCount > 0) {
          console.log(`Auto-promoted ${autoPromotedCount} "Renewal Taken" dropped records to success`);

          // Log activity entries so the timeline shows why status changed
          const activityRows = autoPromoted.map((r: { id: string }) => ({
            renewal_record_id: r.id,
            agency_id: staffUser.agency_id,
            activity_type: 'status_change',
            subject: 'Auto-resolved: Carrier confirmed renewal',
            comments: 'Record dropped from report with "Renewal Taken" status. Automatically marked as successful.',
            created_by_display_name: 'System',
          }));

          const { error: activityError } = await supabase
            .from('renewal_activities')
            .insert(activityRows);

          if (activityError) {
            console.error('Failed to log auto-promote activities:', activityError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        newCount,
        updatedCount,
        errorCount,
        deactivatedCount: droppedCount,
        autoPromotedCount,
        uploadId: upload.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
