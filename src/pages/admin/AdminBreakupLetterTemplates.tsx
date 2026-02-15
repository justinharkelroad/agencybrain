import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save, FileText } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_LETTER_TEMPLATE = `Please accept this as my written request to cancel my current policy(ies) with your company. I have obtained insurance with another insurance company as of the cancellation date(s) listed below.

Policy details:
{{policy_lines}}

Prior Agent/Agency Name: {{prior_agent_agency_name}}

Please return all unearned policy premium to the address listed below and discontinue any future automatic withdrawals for my account.
Please email back confirming receipt of this cancellation request.
If you need additional information, you may contact my new agent {{primary_agent_name}}.
I am also approving the release of information regarding my insurance policies to {{agency_display_name}}.`;

const DEFAULT_EMAIL_TEMPLATE = `Subject: Cancellation Request Letter Attached

Hi {{customer_first_name}},
Attached is your cancellation request letter for {{carrier_name}}.
Please sign and date the letter, then submit it to your prior carrier.
Once submitted, please reply to this email with the carrier's confirmation of cancellation.
If you run into any issues, reply here and we'll help.

Thanks,
{{agency_display_name}}`;

export default function AdminBreakupLetterTemplates() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [letterTemplate, setLetterTemplate] = useState(DEFAULT_LETTER_TEMPLATE);
  const [emailTemplate, setEmailTemplate] = useState(DEFAULT_EMAIL_TEMPLATE);

  useEffect(() => {
    async function loadTemplate() {
      try {
        const { data, error } = await supabase
          .from("breakup_letter_templates")
          .select("id, letter_template, email_template")
          .eq("name", "global_default")
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setTemplateId(data.id);
          setLetterTemplate(data.letter_template || DEFAULT_LETTER_TEMPLATE);
          setEmailTemplate(data.email_template || DEFAULT_EMAIL_TEMPLATE);
        }
      } catch (err) {
        console.error("Failed to load breakup letter template:", err);
        toast.error("Failed to load breakup letter template");
      } finally {
        setLoading(false);
      }
    }

    if (isAdmin) {
      void loadTemplate();
    }
  }, [isAdmin]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const payload = {
        name: "global_default",
        letter_template: letterTemplate,
        email_template: emailTemplate,
        is_active: true,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      if (templateId) {
        const { error } = await supabase
          .from("breakup_letter_templates")
          .update(payload)
          .eq("id", templateId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("breakup_letter_templates")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setTemplateId(data.id);
      }

      toast.success("Global breakup-letter templates saved");
    } catch (err) {
      console.error("Failed to save breakup-letter templates:", err);
      toast.error("Failed to save breakup-letter templates");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Breakup Letter Templates</h1>
      <p className="text-muted-foreground mb-6">
        Global templates used by all agencies for breakup-letter PDF and email body generation.
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Supported Tokens
          </CardTitle>
          <CardDescription>
            Use these placeholders in templates: {"{{customer_first_name}}"}, {"{{customer_full_name}}"}, {"{{carrier_name}}"}, {"{{policy_lines}}"}, {"{{prior_agent_agency_name}}"}, {"{{primary_agent_name}}"}, {"{{agency_display_name}}"}, {"{{zip_code}}"}.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Global Letter Body Template</CardTitle>
          <CardDescription>
            This is injected into the body of the generated PDF. Signature block is always appended by the renderer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="letter-template">Letter Body</Label>
          <Textarea
            id="letter-template"
            value={letterTemplate}
            onChange={(e) => setLetterTemplate(e.target.value)}
            rows={18}
            className="mt-2 font-mono text-xs"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Global Email Body Template</CardTitle>
          <CardDescription>
            Used for the “Copy Email Body” action after PDF generation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="email-template">Email Body</Label>
          <Textarea
            id="email-template"
            value={emailTemplate}
            onChange={(e) => setEmailTemplate(e.target.value)}
            rows={12}
            className="mt-2 font-mono text-xs"
          />

          <div className="flex justify-end mt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Templates
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
