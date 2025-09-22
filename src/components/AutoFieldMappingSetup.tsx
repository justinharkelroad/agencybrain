import { useEffect, useState } from 'react';
import { supabase } from "@/lib/supabaseClient";
import { useBackfillQuotedDetails } from "@/hooks/useBackfillQuotedDetails";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Settings, RefreshCw } from "lucide-react";

interface FormTemplate {
  id: string;
  name: string;
  field_mappings: any;
  agency_id: string;
}

export function AutoFieldMappingSetup() {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  const { backfill, isLoading: isBackfilling } = useBackfillQuotedDetails();

  useEffect(() => {
    loadFormTemplates();
  }, []);

  const loadFormTemplates = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .single();

      if (!profile?.agency_id) return;

      const { data: templates } = await supabase
        .from('form_templates')
        .select('id, name, field_mappings, agency_id')
        .eq('agency_id', profile.agency_id)
        .eq('is_active', true);

      setFormTemplates(templates || []);
    } catch (error) {
      console.error('Error loading form templates:', error);
    }
  };

  const configureFieldMappings = async () => {
    setIsConfiguring(true);
    
    try {
      // Configure field mappings for all active form templates
      for (const template of formTemplates) {
        const fieldMappings = {
          quoted_details: {
            notes: "detailed_notes",
            policies_quoted: "field_1757604704272",
            items_quoted: "items_quoted", // fallback mapping
            premium_potential_cents: "premium_potential_cents" // fallback mapping
          }
        };

        const { error } = await supabase
          .from('form_templates')
          .update({
            field_mappings: fieldMappings,
            updated_at: new Date().toISOString()
          })
          .eq('id', template.id);

        if (error) {
          throw error;
        }

        console.log(`Configured field mappings for form: ${template.name}`);
      }

      toast.success(`Field mappings configured for ${formTemplates.length} form templates`);
      
      // Reload templates to show updated mappings
      await loadFormTemplates();
      
    } catch (error) {
      console.error('Error configuring field mappings:', error);
      toast.error('Failed to configure field mappings');
    } finally {
      setIsConfiguring(false);
    }
  };

  const runBackfill = async () => {
    try {
      // Get agency slug
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .single();

      if (!profile?.agency_id) {
        toast.error('No agency found');
        return;
      }

      const { data: agency } = await supabase
        .from('agencies')
        .select('slug')
        .eq('id', profile.agency_id)
        .single();

      if (!agency?.slug) {
        toast.error('Agency slug not found');
        return;
      }

      const result = await backfill(agency.slug, 30);
      
      if (result.success) {
        setIsComplete(true);
        toast.success('Setup complete! Dashboard and Explorer data should now display correctly.');
      }
      
    } catch (error) {
      console.error('Error running backfill:', error);
      toast.error('Failed to run backfill process');
    }
  };

  const hasFieldMappings = formTemplates.some(t => 
    t.field_mappings && 
    Object.keys(t.field_mappings).length > 0
  );

  if (isComplete) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center text-green-600">
            <CheckCircle className="mr-2 h-5 w-5" />
            Setup Complete
          </CardTitle>
          <CardDescription>
            Field mappings have been configured and data has been backfilled. 
            Your dashboard and explorer should now display team member names, notes, and analytics correctly.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="mr-2 h-5 w-5" />
          Dashboard Data Setup
        </CardTitle>
        <CardDescription>
          Automatically configure field mappings and backfill data to fix dashboard and explorer issues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Configure Field Mappings */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <h3 className="font-medium">Configure Field Mappings</h3>
            <p className="text-sm text-muted-foreground">
              {hasFieldMappings 
                ? `Mappings configured for ${formTemplates.length} form templates`
                : `Set up field mappings for ${formTemplates.length} form templates`
              }
            </p>
          </div>
          <Button
            onClick={configureFieldMappings}
            disabled={isConfiguring || hasFieldMappings}
            variant={hasFieldMappings ? "secondary" : "default"}
          >
            {isConfiguring && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            {hasFieldMappings ? "Configured" : "Configure"}
          </Button>
        </div>

        {/* Step 2: Run Backfill */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <h3 className="font-medium">Backfill Analytics Data</h3>
            <p className="text-sm text-muted-foreground">
              Re-process recent submissions to populate notes and analytics
            </p>
          </div>
          <Button
            onClick={runBackfill}
            disabled={!hasFieldMappings || isBackfilling}
            variant="default"
          >
            {isBackfilling && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            {isBackfilling ? "Processing..." : "Run Backfill"}
          </Button>
        </div>

        {!hasFieldMappings && (
          <p className="text-sm text-muted-foreground">
            Complete field mapping configuration first, then run the backfill process.
          </p>
        )}
      </CardContent>
    </Card>
  );
}