/**
 * Hook for syncing New Business Details sales to LQS
 *
 * This hook handles:
 * 1. Checking which sales already exist in LQS (by policy number)
 * 2. Creating households for new customers
 * 3. Inserting missing sales into lqs_sales
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NewBusinessRecord } from "@/lib/new-business-details-parser";
import { generateHouseholdKey, normalizeProductType } from "@/lib/lqs-sales-parser";

interface TeamMember {
  id: string;
  name: string;
  sub_producer_code: string | null;
}

interface SyncResult {
  success: boolean;
  totalRecords: number;
  existingInLqs: number;
  newSalesCreated: number;
  householdsCreated: number;
  householdsMatched: number;
  teamMembersMatched: number;
  errors: string[];
}

interface SyncProgress {
  stage: "checking" | "creating_households" | "inserting_sales" | "done";
  current: number;
  total: number;
  message: string;
}

export function useSyncSalesToLqs(agencyId: string | null) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);

  const syncSales = useCallback(
    async (
      records: NewBusinessRecord[],
      teamMembers: TeamMember[]
    ): Promise<SyncResult> => {
      if (!agencyId) {
        return {
          success: false,
          totalRecords: 0,
          existingInLqs: 0,
          newSalesCreated: 0,
          householdsCreated: 0,
          householdsMatched: 0,
          teamMembersMatched: 0,
          errors: ["No agency ID provided"],
        };
      }

      setIsSyncing(true);
      const errors: string[] = [];
      let existingInLqs = 0;
      let newSalesCreated = 0;
      let householdsCreated = 0;
      let householdsMatched = 0;
      let teamMembersMatched = 0;

      try {
        // Build team member lookup by sub-producer code
        const teamMemberByCode = new Map<string, TeamMember>();
        teamMembers.forEach((tm) => {
          if (tm.sub_producer_code) {
            teamMemberByCode.set(tm.sub_producer_code.trim(), tm);
          }
        });

        // Step 1: Check which policy numbers already exist in LQS
        setProgress({
          stage: "checking",
          current: 0,
          total: records.length,
          message: "Checking for existing sales in LQS...",
        });

        const policyNumbers = records
          .map((r) => r.policyNumber)
          .filter((p) => p && p.trim());

        const { data: existingSales } = await supabase
          .from("lqs_sales")
          .select("policy_number")
          .eq("agency_id", agencyId)
          .in("policy_number", policyNumbers);

        const existingPolicyNumbers = new Set(
          (existingSales || []).map((s) => s.policy_number)
        );

        existingInLqs = existingPolicyNumbers.size;

        // Filter to only new records
        const newRecords = records.filter(
          (r) => r.policyNumber && !existingPolicyNumbers.has(r.policyNumber)
        );

        if (newRecords.length === 0) {
          setProgress({
            stage: "done",
            current: records.length,
            total: records.length,
            message: "All sales already exist in LQS",
          });
          setIsSyncing(false);
          return {
            success: true,
            totalRecords: records.length,
            existingInLqs,
            newSalesCreated: 0,
            householdsCreated: 0,
            householdsMatched: 0,
            teamMembersMatched: 0,
            errors: [],
          };
        }

        // Step 2: Group records by household key and find/create households
        setProgress({
          stage: "creating_households",
          current: 0,
          total: newRecords.length,
          message: "Matching and creating households...",
        });

        // Generate household keys for all records
        const recordsByHouseholdKey = new Map<string, NewBusinessRecord[]>();
        for (const record of newRecords) {
          // Extract ZIP from customer info if available (not in this report)
          const householdKey = generateHouseholdKey(
            record.firstName,
            record.lastName,
            null // ZIP not available in New Business Details
          );

          if (!recordsByHouseholdKey.has(householdKey)) {
            recordsByHouseholdKey.set(householdKey, []);
          }
          recordsByHouseholdKey.get(householdKey)!.push(record);
        }

        // Check for existing households
        const householdKeys = Array.from(recordsByHouseholdKey.keys());
        const { data: existingHouseholds } = await supabase
          .from("lqs_households")
          .select("id, household_key, team_member_id, contact_id")
          .eq("agency_id", agencyId)
          .in("household_key", householdKeys);

        const householdIdByKey = new Map<string, { id: string; team_member_id: string | null; contact_id: string | null }>();
        (existingHouseholds || []).forEach((h) => {
          householdIdByKey.set(h.household_key, {
            id: h.id,
            team_member_id: h.team_member_id,
            contact_id: h.contact_id,
          });
        });

        householdsMatched = householdIdByKey.size;

        // Create missing households
        const missingKeys = householdKeys.filter((k) => !householdIdByKey.has(k));

        if (missingKeys.length > 0) {
          const householdsToCreate = missingKeys.map((key) => {
            const firstRecord = recordsByHouseholdKey.get(key)![0];

            // Try to match team member
            let teamMemberId: string | null = null;
            if (firstRecord.subProducerCode) {
              const tm = teamMemberByCode.get(firstRecord.subProducerCode);
              if (tm) {
                teamMemberId = tm.id;
                teamMembersMatched++;
              }
            }

            return {
              agency_id: agencyId,
              household_key: key,
              first_name: firstRecord.firstName || "UNKNOWN",
              last_name: firstRecord.lastName || "UNKNOWN",
              zip_code: null,
              status: "lead" as const,
              team_member_id: teamMemberId,
            };
          });

          const { data: createdHouseholds, error: createError } = await supabase
            .from("lqs_households")
            .insert(householdsToCreate)
            .select("id, household_key, team_member_id");

          if (createError) {
            errors.push(`Error creating households: ${createError.message}`);
          } else {
            (createdHouseholds || []).forEach((h) => {
              householdIdByKey.set(h.household_key, {
                id: h.id,
                team_member_id: h.team_member_id,
                contact_id: null, // Newly created, no contact yet
              });
            });
            householdsCreated = createdHouseholds?.length || 0;
          }
        }

        // Step 2b: Create unified contacts for households that don't have one yet
        for (const [key, records2] of recordsByHouseholdKey.entries()) {
          const householdData = householdIdByKey.get(key);
          if (!householdData) continue;
          if (householdData.contact_id) continue; // Already linked

          const firstRec = records2[0];
          if (!firstRec.lastName?.trim()) continue;

          try {
            const { data: contactId } = await supabase.rpc('find_or_create_contact', {
              p_agency_id: agencyId,
              p_first_name: firstRec.firstName || null,
              p_last_name: firstRec.lastName,
              p_zip_code: null,
              p_phone: null,
              p_email: null,
            });
            if (contactId) {
              await supabase
                .from('lqs_households')
                .update({ contact_id: contactId })
                .eq('id', householdData.id)
                .is('contact_id', null); // Only set if not already linked
            }
          } catch (contactErr) {
            console.warn('[Sync Sales] Failed to create contact for household:', key, contactErr);
          }
        }

        // Step 3: Insert sales
        setProgress({
          stage: "inserting_sales",
          current: 0,
          total: newRecords.length,
          message: "Inserting sales into LQS...",
        });

        const salesToInsert = newRecords
          .map((record) => {
            const householdKey = generateHouseholdKey(
              record.firstName,
              record.lastName,
              null
            );
            const householdData = householdIdByKey.get(householdKey);

            if (!householdData) {
              errors.push(
                `Could not find household for ${record.firstName} ${record.lastName}`
              );
              return null;
            }

            // Match team member
            let teamMemberId = householdData.team_member_id;
            if (!teamMemberId && record.subProducerCode) {
              const tm = teamMemberByCode.get(record.subProducerCode);
              if (tm) {
                teamMemberId = tm.id;
              }
            }

            return {
              household_id: householdData.id,
              agency_id: agencyId,
              team_member_id: teamMemberId,
              sale_date: record.issuedDate,
              product_type: normalizeProductType(record.product),
              items_sold: record.itemCount,
              policies_sold: 1,
              premium_cents: Math.round(record.writtenPremium * 100),
              policy_number: record.policyNumber,
              source: "allstate_report" as const,
            };
          })
          .filter((s): s is NonNullable<typeof s> => s !== null);

        if (salesToInsert.length > 0) {
          // Insert in batches
          const batchSize = 100;
          for (let i = 0; i < salesToInsert.length; i += batchSize) {
            const batch = salesToInsert.slice(i, i + batchSize);

            setProgress({
              stage: "inserting_sales",
              current: i,
              total: salesToInsert.length,
              message: `Inserting sales ${i + 1} - ${Math.min(
                i + batchSize,
                salesToInsert.length
              )} of ${salesToInsert.length}...`,
            });

            const { error: insertError } = await supabase
              .from("lqs_sales")
              .insert(batch);

            if (insertError) {
              errors.push(`Error inserting sales batch: ${insertError.message}`);
            } else {
              newSalesCreated += batch.length;
            }
          }
        }

        setProgress({
          stage: "done",
          current: newRecords.length,
          total: newRecords.length,
          message: "Sync complete!",
        });

        return {
          success: errors.length === 0,
          totalRecords: records.length,
          existingInLqs,
          newSalesCreated,
          householdsCreated,
          householdsMatched,
          teamMembersMatched,
          errors,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        errors.push(errorMsg);
        return {
          success: false,
          totalRecords: records.length,
          existingInLqs,
          newSalesCreated,
          householdsCreated,
          householdsMatched,
          teamMembersMatched,
          errors,
        };
      } finally {
        setIsSyncing(false);
      }
    },
    [agencyId]
  );

  return {
    syncSales,
    isSyncing,
    progress,
  };
}
