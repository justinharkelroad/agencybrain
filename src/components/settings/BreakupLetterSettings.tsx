import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

interface BreakupLetterSettingsProps {
  agencyId: string;
}

export function BreakupLetterSettings({ agencyId }: BreakupLetterSettingsProps) {
  const { isAdmin, isAgencyOwner, isKeyEmployee } = useAuth();
  const canEdit = isAdmin || isAgencyOwner || isKeyEmployee;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyDisplayName, setAgencyDisplayName] = useState("");
  const [primaryAgentName, setPrimaryAgentName] = useState("");
  const [primaryAgentPhone, setPrimaryAgentPhone] = useState("");
  const [confirmationReplyEmail, setConfirmationReplyEmail] = useState("");
  const [initialValues, setInitialValues] = useState({
    agencyDisplayName: "",
    primaryAgentName: "",
    primaryAgentPhone: "",
    confirmationReplyEmail: "",
  });

  const isDirty = useMemo(() => {
    return (
      agencyDisplayName !== initialValues.agencyDisplayName ||
      primaryAgentName !== initialValues.primaryAgentName ||
      primaryAgentPhone !== initialValues.primaryAgentPhone ||
      confirmationReplyEmail !== initialValues.confirmationReplyEmail
    );
  }, [agencyDisplayName, confirmationReplyEmail, initialValues, primaryAgentName, primaryAgentPhone]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from("agencies")
          .select(
            "breakup_letter_agency_display_name, breakup_letter_primary_agent_name, breakup_letter_primary_agent_phone, breakup_letter_confirmation_reply_email"
          )
          .eq("id", agencyId)
          .single();

        if (error) throw error;

        const loaded = {
          agencyDisplayName: data?.breakup_letter_agency_display_name || "",
          primaryAgentName: data?.breakup_letter_primary_agent_name || "",
          primaryAgentPhone: data?.breakup_letter_primary_agent_phone || "",
          confirmationReplyEmail: data?.breakup_letter_confirmation_reply_email || "",
        };

        setAgencyDisplayName(loaded.agencyDisplayName);
        setPrimaryAgentName(loaded.primaryAgentName);
        setPrimaryAgentPhone(loaded.primaryAgentPhone);
        setConfirmationReplyEmail(loaded.confirmationReplyEmail);
        setInitialValues(loaded);
      } catch (err) {
        console.error("Failed to load breakup letter settings:", err);
        toast.error("Failed to load breakup letter settings");
      } finally {
        setLoading(false);
      }
    }

    if (agencyId) {
      loadSettings();
    }
  }, [agencyId]);

  const handleSave = async () => {
    if (!canEdit) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("agencies")
        .update({
          breakup_letter_agency_display_name: agencyDisplayName.trim() || null,
          breakup_letter_primary_agent_name: primaryAgentName.trim() || null,
          breakup_letter_primary_agent_phone: primaryAgentPhone.trim() || null,
          breakup_letter_confirmation_reply_email: confirmationReplyEmail.trim() || null,
        })
        .eq("id", agencyId);

      if (error) throw error;
      setInitialValues({
        agencyDisplayName: agencyDisplayName.trim(),
        primaryAgentName: primaryAgentName.trim(),
        primaryAgentPhone: primaryAgentPhone.trim(),
        confirmationReplyEmail: confirmationReplyEmail.trim(),
      });
      toast.success("Breakup letter settings saved");
    } catch (err) {
      console.error("Failed to save breakup letter settings:", err);
      toast.error("Failed to save breakup letter settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Breakup Letter Settings
        </CardTitle>
        <CardDescription>
          Agency-level fields used to prefill cancellation letters. These values never include customer address data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="breakup-agency-display-name">Agency Display Name</Label>
          <Input
            id="breakup-agency-display-name"
            value={agencyDisplayName}
            onChange={(e) => setAgencyDisplayName(e.target.value)}
            placeholder="Agency Display Name"
            disabled={!canEdit || saving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="breakup-primary-agent-name">Primary Agent Name</Label>
          <Input
            id="breakup-primary-agent-name"
            value={primaryAgentName}
            onChange={(e) => setPrimaryAgentName(e.target.value)}
            placeholder="Alex Forster"
            disabled={!canEdit || saving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="breakup-primary-agent-phone">Primary Agent Phone Number</Label>
          <Input
            id="breakup-primary-agent-phone"
            value={primaryAgentPhone}
            onChange={(e) => setPrimaryAgentPhone(e.target.value)}
            placeholder="(260) 489-0156"
            disabled={!canEdit || saving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="breakup-confirmation-reply-email">Confirmation Reply Email</Label>
          <Input
            id="breakup-confirmation-reply-email"
            value={confirmationReplyEmail}
            onChange={(e) => setConfirmationReplyEmail(e.target.value)}
            placeholder="service@youragency.com"
            disabled={!canEdit || saving}
          />
        </div>

        {!canEdit && (
          <p className="text-xs text-muted-foreground">
            Only agency owners, key employees, and admins can edit these values.
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!canEdit || saving || !isDirty}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Breakup Letter Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
