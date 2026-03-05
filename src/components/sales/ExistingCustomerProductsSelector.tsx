import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  EXISTING_CUSTOMER_PRODUCT_OPTIONS,
  normalizeExistingCustomerProducts,
  type ExistingCustomerProductValue,
} from "@/lib/existing-customer-products";
import { Users } from "lucide-react";

interface ExistingCustomerProductsSelectorProps {
  hasExistingPolicies: boolean;
  selectedProducts: string[];
  onHasExistingPoliciesChange: (value: boolean) => void;
  onSelectedProductsChange: (values: ExistingCustomerProductValue[]) => void;
  idPrefix: string;
  previewBundleType?: string | null;
  previewPolicyLabel?: string;
}

export function ExistingCustomerProductsSelector({
  hasExistingPolicies,
  selectedProducts,
  onHasExistingPoliciesChange,
  onSelectedProductsChange,
  idPrefix,
  previewBundleType,
  previewPolicyLabel,
}: ExistingCustomerProductsSelectorProps) {
  const normalizedSelected = normalizeExistingCustomerProducts(selectedProducts);

  const toggleProduct = (value: ExistingCustomerProductValue, checked: boolean) => {
    const next = checked
      ? [...normalizedSelected, value]
      : normalizedSelected.filter((current) => current !== value);
    onSelectedProductsChange(normalizeExistingCustomerProducts(next));
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "p-4 rounded-lg border transition-colors",
          hasExistingPolicies
            ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20"
            : "border-muted bg-muted/30",
        )}
      >
        <div className="flex items-center gap-3">
          <Checkbox
            id={`${idPrefix}-has-existing-policies`}
            checked={hasExistingPolicies}
            onCheckedChange={(checked) => {
              const enabled = checked === true;
              onHasExistingPoliciesChange(enabled);
              if (!enabled) onSelectedProductsChange([]);
            }}
          />
          <Label
            htmlFor={`${idPrefix}-has-existing-policies`}
            className="flex items-center gap-2 cursor-pointer font-medium"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            Customer has existing policies with us
          </Label>
        </div>

        {hasExistingPolicies && (
          <div className="mt-4 pl-7 space-y-3">
            <Label className="text-sm text-muted-foreground">
              What products do they already have?
            </Label>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {EXISTING_CUSTOMER_PRODUCT_OPTIONS.map((option) => {
                const inputId = `${idPrefix}-${option.value}`;
                return (
                  <div key={option.value} className="flex items-center gap-2">
                    <Checkbox
                      id={inputId}
                      checked={normalizedSelected.includes(option.value)}
                      onCheckedChange={(checked) => toggleProduct(option.value, checked === true)}
                    />
                    <Label htmlFor={inputId} className="cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                );
              })}
            </div>

            {previewPolicyLabel && normalizedSelected.length > 0 && previewBundleType && (
              <div className="mt-3 p-2 rounded bg-blue-100 dark:bg-blue-900/30 text-sm">
                {previewBundleType === "Preferred" ? (
                  <span className="text-blue-700 dark:text-blue-300">
                    → Adding {previewPolicyLabel} = <strong>Preferred Bundle</strong>
                  </span>
                ) : previewBundleType === "Standard" ? (
                  <span className="text-blue-700 dark:text-blue-300">
                    → Adding {previewPolicyLabel} = <strong>Standard Bundle</strong>
                  </span>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
