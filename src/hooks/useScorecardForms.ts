import { useState, useEffect } from "react";
import { supa } from '@/lib/supabase';
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface FormTemplate {
  id: string;
  name: string;
  slug: string;
  role: string;
  schema_json: any;
  settings_json: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormLink {
  id: string;
  form_template_id: string;
  token: string;
  enabled: boolean;
  created_at: string;
  expires_at?: string;
}

export function useScorecardForms() {
  const { user } = useAuth();
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string>("");

  useEffect(() => {
    if (user?.id) {
      fetchAgencyAndForms();
    }
  }, [user?.id]);

  const fetchAgencyAndForms = async () => {
    try {
      // Get user's agency
      const { data: profile } = await supa
        .from('profiles')
        .select('agency_id')
        .eq('id', user?.id)
        .single();

      if (profile?.agency_id) {
        setAgencyId(profile.agency_id);

        // Fetch forms for this agency
        const { data: formsData, error } = await supa
          .from('form_templates')
          .select('*')
          .eq('agency_id', profile.agency_id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setForms(formsData || []);
      }
    } catch (error: any) {
      console.error('Error fetching forms:', error);
      toast.error('Failed to load forms');
    } finally {
      setLoading(false);
    }
  };

  const createFormLink = async (formTemplateId: string): Promise<FormLink | null> => {
    try {
      const token = crypto.randomUUID();
      
    const { data, error } = await supa
        .from('form_links')
        .insert({
          form_template_id: formTemplateId,
          token: token,
          enabled: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Form link created successfully!');
      return data;
    } catch (error: any) {
      console.error('Error creating form link:', error);
      toast.error('Failed to create form link');
      return null;
    }
  };

  const getFormLink = async (formTemplateId: string): Promise<FormLink | null> => {
    try {
      const { data, error } = await supa
        .from('form_links')
        .select('*')
        .eq('form_template_id', formTemplateId)
        .eq('enabled', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching form link:', error);
      return null;
    }
  };

  const toggleFormLink = async (formTemplateId: string, enabled: boolean): Promise<boolean> => {
    try {
    const { error } = await supa
        .from('form_links')
        .update({ enabled })
        .eq('form_template_id', formTemplateId);

      if (error) throw error;

      toast.success(`Form link ${enabled ? 'enabled' : 'disabled'} successfully!`);
      return true;
    } catch (error: any) {
      console.error('Error toggling form link:', error);
      toast.error('Failed to update form link');
      return false;
    }
  };

  const deleteForm = async (formId: string): Promise<boolean> => {
    try {
      const { error } = await supa
        .from('form_templates')
        .update({ is_active: false })
        .eq('id', formId);

      if (error) throw error;

      // Refresh the forms list
      await fetchAgencyAndForms();
      toast.success('Form deleted successfully!');
      return true;
    } catch (error: any) {
      console.error('Error deleting form:', error);
      toast.error('Failed to delete form');
      return false;
    }
  };

  const generatePublicUrl = async (form: FormTemplate, token: string) => {
    if (!agencyId) return undefined;
    
    // Get agency details for slug
    const { data: agency } = await supa
      .from('agencies')
      .select('slug')
      .eq('id', agencyId)
      .single();
    
    if (agency?.slug) {
      // Use path-based routing: /f/{agencySlug}/{formSlug}?t={token}
      const baseUrl = window.location.origin;
      return `${baseUrl}/f/${agency.slug}/${form.slug}?t=${token}`;
    }
    
    return undefined;
  };

  return {
    forms,
    loading,
    agencyId,
    createFormLink,
    getFormLink,
    toggleFormLink,
    deleteForm,
    generatePublicUrl,
    refetch: fetchAgencyAndForms,
  };
}