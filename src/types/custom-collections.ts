// Custom Detail Collections Types

export type CustomFieldType = 
  | 'short_text' 
  | 'long_text' 
  | 'number' 
  | 'currency' 
  | 'dropdown' 
  | 'date' 
  | 'checkbox' 
  | 'email' 
  | 'phone';

export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  short_text: 'Short Text',
  long_text: 'Long Text',
  number: 'Number',
  currency: 'Currency',
  dropdown: 'Dropdown',
  date: 'Date',
  checkbox: 'Checkbox',
  email: 'Email',
  phone: 'Phone',
};

export interface CustomDetailField {
  id: string;
  collection_id?: string;
  label: string;
  field_key: string;
  field_type: CustomFieldType;
  is_required: boolean;
  options?: string[];  // For dropdowns
  field_order: number;
}

export interface CustomDetailCollection {
  id: string;
  form_template_id?: string;
  agency_id?: string;
  name: string;
  description?: string;
  controlling_kpi_key?: string;
  is_enabled: boolean;
  field_order: number;
  fields: CustomDetailField[];
  created_at?: string;
  updated_at?: string;
}

// For creating a new collection (without id)
export interface CreateCustomCollectionData {
  name: string;
  description?: string;
  controlling_kpi_key: string;
}

// For creating a new field (without id)
export interface CreateCustomFieldData {
  label: string;
  field_type: CustomFieldType;
  is_required: boolean;
  options?: string[];
}

// Entry data stored in submissions
export interface CustomDetailEntry {
  id?: string;
  submission_id?: string;
  collection_id: string;
  team_member_id?: string;
  agency_id?: string;
  work_date?: string;
  entry_index: number;
  field_values: Record<string, any>;
}

// Schema structure for storing in form_templates.schema_json
export interface CustomCollectionSchemaItem {
  id: string;
  name: string;
  description?: string;
  controllingKpiKey: string;
  enabled: boolean;
  fields: {
    id: string;
    label: string;
    fieldKey: string;
    type: CustomFieldType;
    required: boolean;
    options?: string[];
  }[];
}

// Helper function to generate field key from label
export function generateFieldKey(label: string): string {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
  
  return key || `field_${Date.now()}`;
}

// Helper function to convert DB format to schema format
export function collectionToSchemaFormat(collection: CustomDetailCollection): CustomCollectionSchemaItem {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    controllingKpiKey: collection.controlling_kpi_key || '',
    enabled: collection.is_enabled,
    fields: collection.fields.map(f => ({
      id: f.id,
      label: f.label,
      fieldKey: f.field_key,
      type: f.field_type,
      required: f.is_required,
      options: f.options,
    })),
  };
}

// Helper function to convert schema format to DB format
export function schemaFormatToCollection(item: CustomCollectionSchemaItem): Partial<CustomDetailCollection> {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    controlling_kpi_key: item.controllingKpiKey,
    is_enabled: item.enabled,
    fields: item.fields.map((f, idx) => ({
      id: f.id,
      label: f.label,
      field_key: f.fieldKey,
      field_type: f.type,
      is_required: f.required,
      options: f.options,
      field_order: idx,
      collection_id: item.id,
    })),
  };
}
