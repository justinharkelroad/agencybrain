export type BundleType = "Preferred" | "Standard" | "Monoline";

export type ExistingProductFlag =
  | "auto"
  | "home"
  | "condo"
  | "renters"
  | "landlords"
  | "umbrella"
  | "boat"
  | "motorcycle"
  | "specialty_auto"
  | "non_standard_auto"
  | "other";

const EXCLUDED_PRODUCTS = new Set(["motor club", "bundle"]);

const STANDARD_AUTO_ALIASES = new Set([
  "standard auto",
  "auto",
  "personal auto",
]);

const HOMEOWNER_ALIASES = new Set([
  "homeowners",
  "north light homeowners",
  "home",
]);

const CONDO_ALIASES = new Set([
  "condo",
  "north light condo",
  "condominium",
]);

const PROPERTY_NON_ANCHOR_ALIASES = new Set([
  "renters",
  "landlords",
  "landlord package",
  "landlord/dwelling",
  "mobilehome",
  "manufactured home",
]);

const OTHER_RECOGNIZED_ALIASES = new Set([
  "non-standard auto",
  "auto - special",
  "specialty auto",
  "motorcycle",
  "boatowners",
  "personal umbrella",
  "off-road vehicle",
  "recreational vehicle",
  "flood",
]);

function normalize(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim();
}

function normalizeLineCodeProduct(value: string): string {
  const match = value.match(/^(\d{3})\s*-\s*/);
  if (!match) return value;

  const lineCodeMap: Record<string, string> = {
    "010": "standard auto",
    "020": "motorcycle",
    "021": "motorcycle",
    "070": "homeowners",
    "072": "landlords",
    "073": "renters",
    "074": "condo",
    "078": "condo",
    "080": "boatowners",
    "090": "personal umbrella",
  };

  return lineCodeMap[match[1]] || value;
}

function canonicalize(value: string): string {
  const normalized = normalizeLineCodeProduct(normalize(value));
  if (EXCLUDED_PRODUCTS.has(normalized)) return "excluded";

  if (STANDARD_AUTO_ALIASES.has(normalized)) return "standard_auto";
  if (HOMEOWNER_ALIASES.has(normalized)) return "homeowners";
  if (CONDO_ALIASES.has(normalized)) return "condo";
  if (PROPERTY_NON_ANCHOR_ALIASES.has(normalized)) return "property_other";
  if (OTHER_RECOGNIZED_ALIASES.has(normalized)) return "other_recognized";
  return "unrecognized";
}

function fromExistingFlag(flag: ExistingProductFlag): string {
  switch (flag) {
    case "auto":
      return "standard_auto";
    case "home":
      return "homeowners";
    case "condo":
      return "condo";
    case "renters":
    case "landlords":
      return "property_other";
    case "umbrella":
    case "boat":
    case "motorcycle":
    case "specialty_auto":
    case "non_standard_auto":
    case "other":
      return "other_recognized";
    default:
      return "other_recognized";
  }
}

export interface BundleClassificationInput {
  productNames: Array<string | null | undefined>;
  existingProducts?: ExistingProductFlag[];
}

export interface BundleClassificationResult {
  bundleType: BundleType;
  isBundle: boolean;
  hasStandardAuto: boolean;
  hasPreferredAnchorHome: boolean;
  recognizedProductCount: number;
}

export function classifyBundle(input: BundleClassificationInput): BundleClassificationResult {
  const normalizedProducts = new Set<string>();

  for (const raw of input.productNames || []) {
    const product = canonicalize(raw || "");
    if (!product || product === "excluded" || product === "unrecognized") continue;
    normalizedProducts.add(product);
  }

  for (const existing of input.existingProducts || []) {
    const mapped = fromExistingFlag(existing);
    if (!mapped || mapped === "excluded") continue;
    normalizedProducts.add(mapped);
  }

  const hasStandardAuto = normalizedProducts.has("standard_auto");
  const hasPreferredAnchorHome = normalizedProducts.has("homeowners") ||
    normalizedProducts.has("condo");
  const recognizedProductCount = normalizedProducts.size;

  if (hasStandardAuto && hasPreferredAnchorHome) {
    return {
      bundleType: "Preferred",
      isBundle: true,
      hasStandardAuto,
      hasPreferredAnchorHome,
      recognizedProductCount,
    };
  }

  if (recognizedProductCount >= 2) {
    return {
      bundleType: "Standard",
      isBundle: true,
      hasStandardAuto,
      hasPreferredAnchorHome,
      recognizedProductCount,
    };
  }

  return {
    bundleType: "Monoline",
    isBundle: false,
    hasStandardAuto,
    hasPreferredAnchorHome,
    recognizedProductCount,
  };
}
