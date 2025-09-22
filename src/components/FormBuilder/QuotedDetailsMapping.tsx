import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Schema = Record<string, any>;

type Mapping = {
  repeater?: { 
    quotedDetails?: {
      items_quoted?: string;
      policies_quoted?: string;
      premium_potential_cents?: string;
    }
  };
};

interface QuotedDetailsMappingProps {
  schema: Schema;
  value: Mapping;
  onChange: (m: Mapping) => void;
}

export function QuotedDetailsMapping({ schema, value, onChange }: QuotedDetailsMappingProps) {
  // Get fields from the quotedDetails repeater section
  const quotedFields: Array<{key: string; label: string; type?: string}> = 
    schema?.repeaterSections?.quotedDetails?.fields ?? [];

  // Create options for dropdowns - only numeric fields should be used
  const numericOptions = quotedFields
    .filter(f => f.type === 'number' || f.type === 'currency')
    .map(f => ({
      value: String(f.key ?? ""),
      label: String(f.label ?? f.key)
    }))
    .filter(o => o.value);

  // All field options (for cases where users might want to map non-numeric fields)
  const allOptions = quotedFields
    .map(f => ({
      value: String(f.key ?? ""),
      label: String(f.label ?? f.key),
      type: f.type
    }))
    .filter(o => o.value);

  const current = value?.repeater?.quotedDetails ?? {};

  const setField = (k: keyof NonNullable<Mapping["repeater"]>["quotedDetails"], v: string) => {
    const next: Mapping = {
      ...value,
      repeater: {
        ...(value.repeater ?? {}),
        quotedDetails: {
          ...(value.repeater?.quotedDetails ?? {}),
          [k]: v || undefined
        }
      }
    };
    onChange(next);
  };

  // Check for missing mappings
  const hasItemsMapping = Boolean(current.items_quoted);
  const hasPoliciesMapping = Boolean(current.policies_quoted); 
  const hasPremiumMapping = Boolean(current.premium_potential_cents);
  const allMapped = hasItemsMapping && hasPoliciesMapping && hasPremiumMapping;

  // Check if quoted details section is enabled
  const quotedDetailsEnabled = schema?.repeaterSections?.quotedDetails?.enabled;

  if (!quotedDetailsEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            Quoted Details Mapping
          </CardTitle>
          <CardDescription>
            Enable the "Quoted Household Details" repeater section to configure field mappings for Explorer analytics.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (quotedFields.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            Quoted Details Mapping
          </CardTitle>
          <CardDescription>
            Add fields to your "Quoted Household Details" repeater section to configure mappings for Explorer analytics.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quoted Details Field Mapping</CardTitle>
        <CardDescription>
          Map your repeater fields to Explorer analytics columns for fast querying and sorting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!allMapped && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Some canonical metrics are not mapped. Explorer will show zero values for unmapped fields.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FieldMap 
            label="# Items Quoted"
            description="Total number of items quoted"
            value={current.items_quoted ?? ""}
            options={allOptions}
            preferNumeric={true}
            onChange={(v) => setField("items_quoted", v)}
          />
          <FieldMap 
            label="# Policies Quoted"
            description="Total number of policies quoted"
            value={current.policies_quoted ?? ""}
            options={allOptions}
            preferNumeric={true}
            onChange={(v) => setField("policies_quoted", v)}
          />
          <FieldMap 
            label="Premium Potential (cents)"
            description="Total premium potential in cents"
            value={current.premium_potential_cents ?? ""}
            options={allOptions}
            preferNumeric={true}
            onChange={(v) => setField("premium_potential_cents", v)}
          />
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-medium">Mapping Guidelines:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Only numeric/currency fields should be selected for accurate calculations</li>
            <li>Premium values should be stored in cents (multiply dollars by 100)</li>
            <li>If unmapped, Explorer will fall back to legacy field names or show null</li>
            <li>These mappings ensure fast, sortable queries in the Explorer interface</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

interface FieldMapProps {
  label: string;
  description: string;
  value: string;
  options: Array<{value: string; label: string; type?: string}>;
  preferNumeric?: boolean;
  onChange: (v: string) => void;
}

function FieldMap({ label, description, value, options, preferNumeric, onChange }: FieldMapProps) {
  // Separate numeric and non-numeric options
  const numericOptions = options.filter(o => o.type === 'number' || o.type === 'currency');
  const otherOptions = options.filter(o => o.type !== 'number' && o.type !== 'currency');
  
  const selectedOption = options.find(o => o.value === value);
  const isNonNumericSelected = selectedOption && selectedOption.type !== 'number' && selectedOption.type !== 'currency';

  return (
    <div className="flex flex-col gap-2">
      <div>
        <label className="text-sm font-medium">{label}</label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      
      <Select value={value} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className={isNonNumericSelected ? "border-yellow-500" : ""}>
          <SelectValue placeholder="— Not Mapped —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Not Mapped —</SelectItem>
          
          {numericOptions.length > 0 && (
            <>
              {numericOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label} ({o.type})
                </SelectItem>
              ))}
            </>
          )}
          
          {otherOptions.length > 0 && numericOptions.length > 0 && (
            <SelectItem value="__divider__" disabled className="text-xs text-muted-foreground">
              — Non-numeric fields —
            </SelectItem>
          )}
          
          {otherOptions.length > 0 && (
            <>
              {otherOptions.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-yellow-600">
                  ⚠️ {o.label} ({o.type || 'text'})
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
      
      {isNonNumericSelected && (
        <p className="text-xs text-yellow-600">
          ⚠️ Non-numeric field selected - may cause calculation errors
        </p>
      )}
    </div>
  );
}