import { supabase } from "@/integrations/supabase/client";

interface StickyField {
  field_key: string;
  field_label: string;
  field_type: string;
  is_system_required: boolean;
  order_index: number;
}

interface FormField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  isSticky?: boolean;
  isSystemRequired?: boolean;
  options?: string[];
}

interface RepeaterSection {
  enabled: boolean;
  label: string;
  triggerKPI?: string;
  fields: FormField[];
}

/**
 * Merges sticky fields from database into form schema at runtime.
 * This ensures forms display all sticky fields (items_quoted, policies_quoted, premium_potential)
 * even if they were added after the form was created.
 * Also loads dynamic options for fields like policy_type.
 */
export async function mergeStickyFieldsIntoSchema(schema: any, agencyId?: string): Promise<any> {
  if (!schema?.repeaterSections) {
    return schema;
  }

  try {
    // Process both quotedDetails and soldDetails sections
    const sectionsToProcess = ['quotedDetails', 'soldDetails'];
    
    for (const sectionKey of sectionsToProcess) {
      if (!schema.repeaterSections[sectionKey]) continue;
      
      // Fetch sticky fields for this section
      const { data: stickyFields, error } = await supabase.rpc(
        'get_sticky_fields_for_section',
        { p_section_type: sectionKey }
      ) as { data: StickyField[] | null; error: any };

      if (error || !stickyFields?.length) {
        console.warn(`Could not load sticky fields for ${sectionKey}:`, error);
        continue;
      }

      const section = schema.repeaterSections[sectionKey] as RepeaterSection;
      const existingFieldKeys = new Set(section.fields.map(f => f.key));
      const stickyFieldKeys = new Set(stickyFields.map(sf => sf.field_key));

      // Create sticky fields array from database
      const stickyFieldsArray: FormField[] = stickyFields.map(sf => ({
        key: sf.field_key,
        label: sf.field_label,
        type: sf.field_type,
        required: sf.is_system_required,
        isSticky: true,
        isSystemRequired: sf.is_system_required
      }));

      // Keep custom fields that aren't sticky (added by admin)
      const customFields = section.fields.filter(f => !stickyFieldKeys.has(f.key) && !f.isSticky);

      // Merge: sticky fields first (by order_index), then custom fields
      section.fields = [...stickyFieldsArray, ...customFields];
    }

    // Load policy types options for multiselect fields if agencyId is provided
    // or try to infer from the schema
    if (agencyId) {
      await loadPolicyTypeOptions(schema, agencyId);
    }

    return schema;
  } catch (err) {
    console.error('Error merging sticky fields:', err);
    return schema;
  }
}

/**
 * Loads policy type options from database and injects into multiselect fields
 */
async function loadPolicyTypeOptions(schema: any, agencyId: string): Promise<void> {
  try {
    const { data: policyTypes, error } = await supabase
      .from('policy_types')
      .select('name')
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .order('order_index');

    if (error || !policyTypes?.length) {
      console.warn('Could not load policy types:', error);
      return;
    }

    const options = policyTypes.map(pt => pt.name);

    // Inject options into policy_type fields in all repeater sections
    for (const sectionKey of Object.keys(schema.repeaterSections || {})) {
      const section = schema.repeaterSections[sectionKey];
      if (section?.fields) {
        section.fields = section.fields.map((field: FormField) => {
          if (field.key === 'policy_type' && (field.type === 'select' || field.type === 'multiselect')) {
            return { ...field, options };
          }
          return field;
        });
      }
    }
  } catch (err) {
    console.error('Error loading policy type options:', err);
  }
}
