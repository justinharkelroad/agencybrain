export interface LqsQuoteDraft {
  productType: string;
  premium: number;
  items: number;
  policyNumber?: string | null;
}

export interface LqsSalePrefill {
  source: 'lqs_household';
  householdId: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerZip?: string | null;
  leadSourceId?: string | null;
  priorInsuranceCompanyId?: string | null;
  teamMemberId?: string | null;
  saleDate?: string | null;
  quoteDrafts: LqsQuoteDraft[];
}
