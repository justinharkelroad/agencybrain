import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type BreakupPolicy = {
  id: string;
  policyTypeName: string;
  policyNumber: string;
  effectiveDate: string;
  carrierName: string;
};

interface BreakupLetterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  customerName: string;
  customerZip?: string;
  customerEmail?: string;
  customerPhone?: string;
  policies: BreakupPolicy[];
  onContinueToSequence: () => void;
  contactId?: string;
  sourceContext?: "sale_upload" | "contact_sidebar" | "unknown";
}

type CarrierGroup = {
  id: string;
  carrierName: string;
  policies: BreakupPolicy[];
};

type GeneratedFile = {
  filename: string;
  url: string;
};

type AgencyBreakupSettings = {
  agencyDisplayName: string;
  primaryAgentName: string;
};

const toTitleCase = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const splitName = (fullName: string) => {
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  if (!cleaned) return { firstName: "", lastName: "" };
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

const makePolicyId = () => crypto.randomUUID();

const groupPoliciesByCarrier = (policies: BreakupPolicy[]): CarrierGroup[] => {
  const map = new Map<string, CarrierGroup>();

  policies.forEach((policy) => {
    const carrierName = policy.carrierName?.trim() || "Prior Carrier";
    if (!map.has(carrierName)) {
      map.set(carrierName, {
        id: crypto.randomUUID(),
        carrierName,
        policies: [],
      });
    }
    map.get(carrierName)!.policies.push({
      ...policy,
      id: policy.id || makePolicyId(),
    });
  });

  return Array.from(map.values());
};

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

const renderTemplate = (template: string, tokens: Record<string, string>) => {
  let output = template;
  Object.entries(tokens).forEach(([key, value]) => {
    output = output.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || "");
  });
  return output;
};

const createBreakupLetterPdf = (params: {
  firstName: string;
  lastName: string;
  addressText: string;
  carrierName: string;
  priorAgentAgencyName: string;
  agencyDisplayName: string;
  primaryAgentName: string;
  policies: Array<{ policyTypeName: string; policyNumber: string; effectiveDate: string }>;
  letterBody: string;
}) => {
  const {
    firstName,
    lastName,
    addressText,
    carrierName,
    policies,
    letterBody,
  } = params;

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 54;
  let y = 56;

  const writeParagraph = (text: string, fontSize = 12, leading = 18) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, pageWidth - marginX * 2);
    doc.text(lines, marginX, y);
    y += lines.length * leading;
  };

  const customerFullName = [firstName, lastName].filter(Boolean).join(" ").trim() || "Customer";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(format(new Date(), "MMMM d, yyyy"), marginX, y);
  y += 28;
  doc.setFont("helvetica", "bold");
  doc.text("Customer Service", marginX, y);
  y += 18;
  doc.text(carrierName || "Prior Carrier", marginX, y);
  y += 34;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const subjectLines = doc.splitTextToSize(
    `Subject: Cancellation of Policies for ${customerFullName}`,
    pageWidth - marginX * 2
  );
  doc.text(subjectLines, marginX, y);
  y += (subjectLines.length - 1) * 22 + 30;

  writeParagraph(letterBody, 12, 18);

  y += 20;
  doc.text("Thanks,", marginX, y);
  y += 44;
  doc.text("X______________________________________________", marginX, y);
  y += 26;
  doc.setFont("helvetica", "normal");
  doc.text(customerFullName, marginX, y);
  y += 18;

  if (addressText.trim()) {
    const addressLines = doc.splitTextToSize(addressText.trim(), pageWidth - marginX * 2);
    doc.text(addressLines, marginX, y);
  }

  return doc;
};

export function BreakupLetterModal({
  open,
  onOpenChange,
  agencyId,
  customerName,
  customerZip,
  customerEmail,
  customerPhone,
  policies,
  onContinueToSequence,
  contactId,
  sourceContext = "unknown",
}: BreakupLetterModalProps) {
  const parsedName = useMemo(() => splitName(customerName), [customerName]);
  const [firstName, setFirstName] = useState(parsedName.firstName);
  const [lastName, setLastName] = useState(parsedName.lastName);
  const [zipCode, setZipCode] = useState(customerZip || "");
  const [email] = useState(customerEmail || "");
  const [phone] = useState(customerPhone || "");
  const [addressText, setAddressText] = useState("");
  const [priorAgentAgencyName, setPriorAgentAgencyName] = useState("");
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>(groupPoliciesByCarrier(policies));
  const [agencySettings, setAgencySettings] = useState<AgencyBreakupSettings>({
    agencyDisplayName: "",
    primaryAgentName: "",
  });
  const [letterTemplate, setLetterTemplate] = useState(DEFAULT_LETTER_TEMPLATE);
  const [emailTemplate, setEmailTemplate] = useState(DEFAULT_EMAIL_TEMPLATE);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);

  useEffect(() => {
    setFirstName(parsedName.firstName);
    setLastName(parsedName.lastName);
  }, [parsedName.firstName, parsedName.lastName]);

  useEffect(() => {
    setZipCode(customerZip || "");
  }, [customerZip]);

  useEffect(() => {
    setCarrierGroups(groupPoliciesByCarrier(policies));
  }, [policies]);

  useEffect(() => {
    if (!open || !agencyId) return;

    const loadAgencySettings = async () => {
      setLoadingSettings(true);
      try {
        const [{ data: agencyData, error: agencyError }, { data: templateData, error: templateError }] =
          await Promise.all([
            supabase
              .from("agencies")
              .select("breakup_letter_agency_display_name, breakup_letter_primary_agent_name")
              .eq("id", agencyId)
              .single(),
            supabase
              .from("breakup_letter_templates")
              .select("letter_template, email_template")
              .eq("is_active", true)
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);
        if (agencyError) throw agencyError;

        setAgencySettings({
          agencyDisplayName: agencyData?.breakup_letter_agency_display_name || "",
          primaryAgentName: agencyData?.breakup_letter_primary_agent_name || "",
        });
        if (!templateError && templateData) {
          setLetterTemplate(templateData.letter_template || DEFAULT_LETTER_TEMPLATE);
          setEmailTemplate(templateData.email_template || DEFAULT_EMAIL_TEMPLATE);
        }
      } catch (err) {
        console.error("Failed to load breakup letter settings:", err);
      } finally {
        setLoadingSettings(false);
      }
    };

    void loadAgencySettings();
  }, [agencyId, open]);

  useEffect(() => {
    return () => {
      generatedFiles.forEach((file) => URL.revokeObjectURL(file.url));
    };
  }, [generatedFiles]);

  const updateCarrierName = (carrierId: string, value: string) => {
    setCarrierGroups((current) =>
      current.map((group) => (group.id === carrierId ? { ...group, carrierName: value } : group))
    );
  };

  const updatePolicyField = (
    carrierId: string,
    policyId: string,
    field: keyof BreakupPolicy,
    value: string
  ) => {
    setCarrierGroups((current) =>
      current.map((group) => {
        if (group.id !== carrierId) return group;
        return {
          ...group,
          policies: group.policies.map((policy) =>
            policy.id === policyId ? { ...policy, [field]: value } : policy
          ),
        };
      })
    );
  };

  const addPolicy = (carrierId: string) => {
    setCarrierGroups((current) =>
      current.map((group) => {
        if (group.id !== carrierId) return group;
        return {
          ...group,
          policies: [
            ...group.policies,
            {
              id: makePolicyId(),
              policyTypeName: "",
              policyNumber: "",
              effectiveDate: format(new Date(), "yyyy-MM-dd"),
              carrierName: group.carrierName,
            },
          ],
        };
      })
    );
  };

  const handleGenerate = async () => {
    if (carrierGroups.length === 0) {
      toast.error("Add at least one carrier before generating.");
      return;
    }

    setGenerating(true);
    try {
      generatedFiles.forEach((file) => URL.revokeObjectURL(file.url));
      const createdFiles: GeneratedFile[] = [];

      carrierGroups.forEach((group) => {
        const policyLines = group.policies
          .map((policy) => {
            const policyLabel = policy.policyTypeName || "Policy";
            const policyNumber = policy.policyNumber || "Not provided";
            const cancelDate = policy.effectiveDate || format(new Date(), "yyyy-MM-dd");
            return `${policyLabel} | Policy Number: ${policyNumber} | Cancellation Date: ${cancelDate}`;
          })
          .join("\n");

        const letterBody = renderTemplate(letterTemplate, {
          customer_first_name: toTitleCase(firstName),
          customer_last_name: toTitleCase(lastName),
          customer_full_name: `${toTitleCase(firstName)} ${toTitleCase(lastName)}`.trim(),
          carrier_name: group.carrierName.trim() || "Prior Carrier",
          cancellation_date: group.policies[0]?.effectiveDate || format(new Date(), "yyyy-MM-dd"),
          policy_lines: policyLines,
          prior_agent_agency_name: priorAgentAgencyName.trim() || "Not provided",
          primary_agent_name: agencySettings.primaryAgentName.trim() || "",
          agency_display_name: agencySettings.agencyDisplayName.trim() || "my new agency",
          zip_code: zipCode.trim(),
        });

        const pdf = createBreakupLetterPdf({
          firstName: toTitleCase(firstName),
          lastName: toTitleCase(lastName),
          addressText: addressText.trim(),
          carrierName: group.carrierName.trim() || "Prior Carrier",
          priorAgentAgencyName: priorAgentAgencyName.trim(),
          agencyDisplayName: agencySettings.agencyDisplayName.trim(),
          primaryAgentName: agencySettings.primaryAgentName.trim(),
          policies: group.policies.map((policy) => ({
            policyTypeName: policy.policyTypeName.trim(),
            policyNumber: policy.policyNumber.trim(),
            effectiveDate: policy.effectiveDate,
          })),
          letterBody,
        });

        const blob = pdf.output("blob");
        const url = URL.createObjectURL(blob);
        const safeCarrier = (group.carrierName || "carrier").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
        const safeName = `${toTitleCase(firstName)}-${toTitleCase(lastName)}`
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .toLowerCase();
        const filename = `breakup-letter-${safeName}-${safeCarrier}.pdf`;

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        createdFiles.push({ filename, url });
      });

      setGeneratedFiles(createdFiles);

      const { error: eventError } = await supabase.from("breakup_letter_generation_events").insert({
        agency_id: agencyId,
        contact_id: contactId || null,
        customer_name: [firstName, lastName].filter(Boolean).join(" ").trim() || null,
        source_context: sourceContext,
        carrier_count: carrierGroups.length,
        policy_count: carrierGroups.reduce((sum, group) => sum + group.policies.length, 0),
      });

      if (eventError) {
        // Do not block customer-facing download success on telemetry failure.
        console.warn("Breakup letter generation event logging failed:", eventError);
      }

      toast.success(`Generated ${createdFiles.length} breakup letter${createdFiles.length > 1 ? "s" : ""}.`);
    } catch (err) {
      console.error("Failed to generate breakup letter:", err);
      toast.error("Failed to generate breakup letter.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyEmailBody = () => {
    const carrier = carrierGroups[0]?.carrierName || "Prior Carrier";
    const body = renderTemplate(emailTemplate, {
      customer_first_name: toTitleCase(firstName) || "[Customer First Name]",
      carrier_name: carrier || "[Carrier Name]",
      agency_display_name: agencySettings.agencyDisplayName || "[Agency Display Name]",
    });
    navigator.clipboard.writeText(body).then(
      () => toast.success("Email body copied to clipboard."),
      () => toast.error("Failed to copy email body.")
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Breakup Letter
          </DialogTitle>
          <DialogDescription>
            This generates download-only PDF letters and does not persist customer address details.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>First Name</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Last Name</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>ZIP Code</Label>
            <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Prior Agent/Agency Name</Label>
            <Input
              value={priorAgentAgencyName}
              onChange={(e) => setPriorAgentAgencyName(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Address (Optional, not saved)</Label>
            <Textarea
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              placeholder="Street, City, State ZIP"
              rows={2}
            />
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">
            Contact values are available in-app for context only. Phone and email are never printed on the PDF.
            {loadingSettings ? " Loading agency breakup-letter settings..." : ""}
            {email ? ` Customer Email: ${email}.` : ""}
            {phone ? ` Customer Phone: ${phone}.` : ""}
          </p>
        </div>

        <div className="space-y-4">
          {carrierGroups.map((carrier) => (
            <Card key={carrier.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Carrier Letter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Carrier Name</Label>
                  <Input
                    value={carrier.carrierName}
                    onChange={(e) => updateCarrierName(carrier.id, e.target.value)}
                    placeholder="Prior Carrier"
                  />
                </div>

                {carrier.policies.map((policy) => (
                  <div key={policy.id} className="grid gap-2 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Policy Type</Label>
                      <Input
                        value={policy.policyTypeName}
                        onChange={(e) =>
                          updatePolicyField(carrier.id, policy.id, "policyTypeName", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Policy Number</Label>
                      <Input
                        value={policy.policyNumber}
                        onChange={(e) =>
                          updatePolicyField(carrier.id, policy.id, "policyNumber", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cancellation Date</Label>
                      <Input
                        type="date"
                        value={policy.effectiveDate}
                        onChange={(e) =>
                          updatePolicyField(carrier.id, policy.id, "effectiveDate", e.target.value)
                        }
                      />
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" size="sm" onClick={() => addPolicy(carrier.id)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Policy
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {generatedFiles.length > 0 && (
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-medium">Generated files</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCopyEmailBody}>
                Copy Email Body
              </Button>
              {generatedFiles.map((file) => (
                <Button
                  key={file.filename}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(file.url, "_blank", "noopener,noreferrer")}
                >
                  Open {file.filename}
                </Button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" variant="outline" onClick={handleGenerate} disabled={generating}>
            {generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generate PDF
          </Button>
          <Button type="button" onClick={onContinueToSequence}>
            Continue to Sequence
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
