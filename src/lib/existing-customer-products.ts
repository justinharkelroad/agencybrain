import type { ExistingProductFlag } from "@/lib/bundle-classifier";

export type ExistingCustomerProductValue = Exclude<ExistingProductFlag, "other">;

export const EXISTING_CUSTOMER_PRODUCT_OPTIONS: Array<{
  value: ExistingCustomerProductValue;
  label: string;
}> = [
  { value: "auto", label: "Standard Auto" },
  { value: "home", label: "Homeowners" },
  { value: "condo", label: "Condo" },
  { value: "renters", label: "Renters" },
  { value: "landlords", label: "Landlords" },
  { value: "umbrella", label: "Umbrella" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "boat", label: "Boat" },
  { value: "specialty_auto", label: "Specialty Auto" },
  { value: "non_standard_auto", label: "Non-Standard Auto" },
];

const LEGACY_VALUE_MAP: Record<string, ExistingCustomerProductValue> = {
  auto: "auto",
  "standard auto": "auto",
  home: "home",
  homeowners: "home",
  property: "home",
  "home/property": "home",
  condo: "condo",
  renters: "renters",
  landlords: "landlords",
  landlord: "landlords",
  umbrella: "umbrella",
  "personal umbrella": "umbrella",
  motorcycle: "motorcycle",
  boat: "boat",
  boatowners: "boat",
  specialty_auto: "specialty_auto",
  "specialty auto": "specialty_auto",
  non_standard_auto: "non_standard_auto",
  "non-standard auto": "non_standard_auto",
};

export function normalizeExistingCustomerProducts(
  values: Array<string | null | undefined>,
): ExistingCustomerProductValue[] {
  const normalized = new Set<ExistingCustomerProductValue>();

  for (const value of values || []) {
    const key = (value || "").toLowerCase().trim();
    const mapped = LEGACY_VALUE_MAP[key];
    if (mapped) normalized.add(mapped);
  }

  return EXISTING_CUSTOMER_PRODUCT_OPTIONS
    .map((option) => option.value)
    .filter((value) => normalized.has(value));
}

