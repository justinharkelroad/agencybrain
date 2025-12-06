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
 */
export async function mergeStickyFieldsIntoSchema(schema: any): Promise<any> {
  if (!schema?.repeaterSections?.quotedDetails) {
    return schema;
  }

  try {
    // Fetch sticky fields for quotedDetails section
    const { data: stickyFields, error } = await supabase.rpc(
      'get_sticky_fields_for_section',
      { p_section_type: 'quotedDetails' }
    ) as { data: StickyField[] | null; error: any };

    if (error || !stickyFields?.length) {
      console.warn('Could not load sticky fields:', error);
      return schema;
    }

    const section = schema.repeaterSections.quotedDetails as RepeaterSection;
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

    return schema;
  } catch (err) {
    console.error('Error merging sticky fields:', err);
    return schema;
  }
}
