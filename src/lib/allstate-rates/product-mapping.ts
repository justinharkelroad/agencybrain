export type ProductCategory = 'StandardAuto' | 'HomeownersCondo' | 'OtherPersonal' | 'Excluded';

interface ProductMapping {
  category: ProductCategory;
  vcEligible: boolean;
  notes?: string;
}

// Map product names from statements to categories
export const PRODUCT_MAPPINGS: Record<string, ProductMapping> = {
  // Standard Auto products
  'AUTO PRIVATE PASS.': { category: 'StandardAuto', vcEligible: true },
  'AFCIC-AUTO PRIV PASS': { category: 'StandardAuto', vcEligible: true },
  'AUTO-INDEM': { category: 'StandardAuto', vcEligible: true },
  'Standard Auto': { category: 'StandardAuto', vcEligible: true },
  
  // Homeowners/Condo
  'HOUSE AND HOME': { category: 'HomeownersCondo', vcEligible: true },
  'TX LLOYDS HOMEOWNERS': { category: 'HomeownersCondo', vcEligible: true },
  'AFCIC-HOMEOWNERS': { category: 'HomeownersCondo', vcEligible: true },
  'Homeowners': { category: 'HomeownersCondo', vcEligible: true },
  'CONDOMINIUM OWNERS': { category: 'HomeownersCondo', vcEligible: true },
  
  // Other Personal
  'MANUFACTURED HOMES': { category: 'OtherPersonal', vcEligible: true },
  'RENTERS-INDEM': { category: 'OtherPersonal', vcEligible: true },
  'Renters': { category: 'OtherPersonal', vcEligible: true },
  'PUP INDEM': { category: 'OtherPersonal', vcEligible: true },
  
  // Excluded from VC
  'ALLSTATE FLOOD INS.': { category: 'Excluded', vcEligible: false },
  'MOTOR CLUB': { category: 'Excluded', vcEligible: false },
  'VARIABLE UL': { category: 'Excluded', vcEligible: false },
  'MUTUAL FUNDS': { category: 'Excluded', vcEligible: false },
  'PERSONAL LIFE': { category: 'Excluded', vcEligible: false },
};

export function getProductCategory(productName: string): ProductMapping {
  // Direct match first
  if (PRODUCT_MAPPINGS[productName]) {
    return PRODUCT_MAPPINGS[productName];
  }
  
  // Partial match - check if product name contains any key
  const upperName = productName.toUpperCase();
  for (const [key, value] of Object.entries(PRODUCT_MAPPINGS)) {
    if (upperName.includes(key.toUpperCase())) {
      return value;
    }
  }
  
  // Unknown - mark as excluded but flag for review
  return { category: 'Excluded', vcEligible: false, notes: 'Unknown product' };
}
