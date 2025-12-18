import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Eye } from "lucide-react";

interface KPIField {
  key: string;
  label: string;
  required: boolean;
  type: 'number' | 'currency' | 'percentage';
  target?: {
    minimum?: number;
    goal?: number;
    excellent?: number;
  };
}

interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'longtext' | 'dropdown' | 'radio' | 'checkbox' | 'date';
  required: boolean;
  options?: string[];
}

interface RepeaterSection {
  enabled: boolean;
  title: string;
  description?: string;
  triggerKPI?: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'select' | 'multiselect' | 'number' | 'currency';
    required: boolean;
    options?: string[];
  }>;
}

interface LeadSource {
  id: string;
  name: string;
  is_active: boolean;
  order_index: number;
}

interface FormSchema {
  title: string;
  role: 'Sales' | 'Service';
  kpis: KPIField[];
  customFields?: CustomField[];
  leadSources?: LeadSource[];
  repeaterSections?: {
    quotedDetails: RepeaterSection;
    soldDetails: RepeaterSection;
    customCollections?: Array<{
      id: string;
      name: string;
      description?: string;
      controllingKpiKey: string;
      enabled: boolean;
      fields: Array<{
        id: string;
        label: string;
        fieldKey: string;
        type: string;
        required: boolean;
        options?: string[];
      }>;
    }>;
  };
  settings: {
    dueBy: string;
    customDueTime?: string;
    lateCountsForPass: boolean;
    reminderTimes: string[];
    ccOwner: boolean;
    suppressIfFinal: boolean;
  };
}

interface FormPreviewProps {
  formSchema: FormSchema;
}

export default function FormPreview({ formSchema }: FormPreviewProps) {
  const renderKPIField = (kpi: KPIField) => {
    const getTargetBadge = () => {
      if (!kpi.target) return null;
      const { minimum, goal, excellent } = kpi.target;
      if (minimum || goal || excellent) {
        return (
          <div className="text-xs text-muted-foreground mt-1">
            {minimum && `Min: ${minimum}`}
            {goal && `${minimum ? ' • ' : ''}Goal: ${goal}`}
            {excellent && `${(minimum || goal) ? ' • ' : ''}Excellent: ${excellent}`}
          </div>
        );
      }
      return null;
    };

    return (
      <div key={kpi.key}>
        <Label className="text-sm">
          {kpi.label}
          {kpi.required && <span className="text-destructive">*</span>}
        </Label>
        <Input 
          type={kpi.type === 'number' ? 'number' : 'text'} 
          disabled 
          placeholder={
            kpi.type === 'currency' ? '$0.00' : 
            kpi.type === 'percentage' ? '0%' : '0'
          }
        />
        {getTargetBadge()}
      </div>
    );
  };

  const renderCustomField = (field: CustomField) => {
    switch (field.type) {
      case 'text':
        return (
          <div key={field.key}>
            <Label className="text-sm">
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Input disabled placeholder="Enter text..." />
          </div>
        );
      
      case 'longtext':
        return (
          <div key={field.key}>
            <Label className="text-sm">
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Textarea disabled placeholder="Enter detailed information..." rows={3} />
          </div>
        );
      
      case 'dropdown':
        return (
          <div key={field.key}>
            <Label className="text-sm">
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Select disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select option..." />
              </SelectTrigger>
              <SelectContent>
                {field.options?.filter(option => option && option.trim() !== '').map((option, idx) => (
                  <SelectItem key={idx} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      
      case 'radio':
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-sm">
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <RadioGroup disabled>
              {field.options?.map((option, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.key}-${idx}`} />
                  <Label htmlFor={`${field.key}-${idx}`} className="text-sm">{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      
      case 'checkbox':
        return (
          <div key={field.key} className="flex items-center space-x-2">
            <Checkbox disabled id={field.key} />
            <Label htmlFor={field.key} className="text-sm">
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
          </div>
        );
      
      case 'date':
        return (
          <div key={field.key}>
            <Label className="text-sm">
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Input type="date" disabled />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Form Preview
        </CardTitle>
        <CardDescription>
          Preview how your form will look to staff members
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border-2 border-dashed border-muted rounded-lg space-y-4">
          <h3 className="font-semibold text-lg">{formSchema.title}</h3>
          
          <div className="space-y-4">
            <div>
              <Label>Staff Member</Label>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member..." />
                </SelectTrigger>
              </Select>
            </div>

            <div>
              <Label>Submission Date</Label>
              <Input type="date" disabled value={new Date().toISOString().split('T')[0]} />
            </div>


            {formSchema.kpis.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Daily KPIs</h4>
                <div className="grid grid-cols-2 gap-3">
                  {formSchema.kpis.map(renderKPIField)}
                </div>
              </div>
            )}

            {formSchema.customFields && formSchema.customFields.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Additional Information</h4>
                <div className="space-y-3">
                  {formSchema.customFields.map(renderCustomField)}
                </div>
              </div>
            )}

            {formSchema.repeaterSections?.quotedDetails?.enabled && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">{formSchema.repeaterSections.quotedDetails.title}</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="mb-2">{formSchema.repeaterSections.quotedDetails.description}</p>
                  {formSchema.repeaterSections.quotedDetails.fields.map(field => (
                    <p key={field.key}>
                      {field.type === 'multiselect' ? '☑' : '•'} {field.label}
                      {field.type === 'multiselect' && <span className="text-xs ml-1">(multi-select)</span>}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {formSchema.repeaterSections?.soldDetails?.enabled && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">{formSchema.repeaterSections.soldDetails.title}</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="mb-2">{formSchema.repeaterSections.soldDetails.description}</p>
                  {formSchema.repeaterSections.soldDetails.fields.map(field => (
                    <p key={field.key}>
                      {field.type === 'multiselect' ? '☑' : '•'} {field.label}
                      {field.type === 'multiselect' && <span className="text-xs ml-1">(multi-select)</span>}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Collections Preview */}
            {formSchema.repeaterSections?.customCollections?.filter(c => c.enabled).map(collection => (
              <div key={collection.id} className="border-t pt-4">
                <h4 className="font-medium mb-3">{collection.name}</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {collection.description && <p className="mb-2">{collection.description}</p>}
                  {collection.fields.map(field => (
                    <p key={field.id}>
                      • {field.label} {field.required && <span className="text-destructive">*</span>}
                    </p>
                  ))}
                  {collection.fields.length === 0 && (
                    <p className="italic">No fields configured</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}