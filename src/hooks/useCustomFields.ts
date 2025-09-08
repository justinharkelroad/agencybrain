import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface CustomField {
  id: string;
  agency_id: string;
  owner_user_id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  order_index: number;
  active: boolean;
  created_at: string;
  options?: string[]; // For dropdown fields
}

export interface CreateCustomFieldData {
  field_key: string;
  field_label: string;
  field_type: string;
  order_index?: number;
  options?: string[]; // For dropdown fields
}

export function useCustomFields(agencyId: string) {
  const { user } = useAuth();
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCustomFields = async () => {
    if (!user || !agencyId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('prospect_custom_fields')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('owner_user_id', user.id)
        .eq('active', true)
        .order('order_index');

      if (error) throw error;
      setCustomFields(data || []);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
      toast.error('Failed to load custom fields');
    } finally {
      setLoading(false);
    }
  };

  const createCustomField = async (fieldData: CreateCustomFieldData) => {
    if (!user || !agencyId) return false;

    try {
      const { error } = await supabase
        .from('prospect_custom_fields')
        .insert({
          agency_id: agencyId,
          owner_user_id: user.id,
          field_key: fieldData.field_key,
          field_label: fieldData.field_label,
          field_type: fieldData.field_type,
          order_index: fieldData.order_index ?? customFields.length,
          active: true,
          options: fieldData.options || null
        });

      if (error) throw error;
      
      toast.success('Custom field created successfully');
      await fetchCustomFields();
      return true;
    } catch (error) {
      console.error('Error creating custom field:', error);
      toast.error('Failed to create custom field');
      return false;
    }
  };

  const updateCustomField = async (fieldId: string, updates: Partial<CustomField>) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('prospect_custom_fields')
        .update(updates)
        .eq('id', fieldId)
        .eq('owner_user_id', user.id);

      if (error) throw error;
      
      toast.success('Custom field updated successfully');
      await fetchCustomFields();
      return true;
    } catch (error) {
      console.error('Error updating custom field:', error);
      toast.error('Failed to update custom field');
      return false;
    }
  };

  const deleteCustomField = async (fieldId: string) => {
    if (!user) return false;

    try {
      // Soft delete by setting active to false
      const { error } = await supabase
        .from('prospect_custom_fields')
        .update({ active: false })
        .eq('id', fieldId)
        .eq('owner_user_id', user.id);

      if (error) throw error;
      
      toast.success('Custom field deleted successfully');
      await fetchCustomFields();
      return true;
    } catch (error) {
      console.error('Error deleting custom field:', error);
      toast.error('Failed to delete custom field');
      return false;
    }
  };

  const reorderCustomFields = async (fieldIds: string[]) => {
    if (!user) return false;

    try {
      const updates = fieldIds.map((id, index) => 
        supabase
          .from('prospect_custom_fields')
          .update({ order_index: index })
          .eq('id', id)
          .eq('owner_user_id', user.id)
      );

      await Promise.all(updates);
      
      toast.success('Field order updated successfully');
      await fetchCustomFields();
      return true;
    } catch (error) {
      console.error('Error reordering custom fields:', error);
      toast.error('Failed to update field order');
      return false;
    }
  };

  useEffect(() => {
    if (user && agencyId) {
      fetchCustomFields();
    }
  }, [user, agencyId]);

  return {
    customFields,
    loading,
    fetchCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    reorderCustomFields
  };
}