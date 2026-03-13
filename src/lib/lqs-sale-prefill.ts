export interface SalesQuoteDraft {
  productType: string;
  premium: number;
  items: number;
  policyNumber?: string | null;
}

export interface LqsHouseholdSalePrefill {
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
  quoteDrafts: SalesQuoteDraft[];
}

export interface WinbackReferencePolicy {
  id: string;
  productName: string;
  priorPolicyNumber?: string | null;
}

export interface WinbackHouseholdSalePrefill {
  source: 'winback_household';
  winbackHouseholdId: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerZip?: string | null;
  leadSourceId?: string | null;
  priorInsuranceCompanyId?: string | null;
  teamMemberId?: string | null;
  saleDate?: string | null;
  quoteDrafts: SalesQuoteDraft[];
  referencePolicies?: WinbackReferencePolicy[];
}

export type SalesPrefill = LqsHouseholdSalePrefill | WinbackHouseholdSalePrefill;

export interface WinbackSaleCompletionContext {
  source: 'winback_household';
  householdId: string;
  agencyId: string;
  oldStatus: 'untouched' | 'in_progress' | 'declined' | 'no_contact';
  actorTeamMemberId?: string | null;
  actorName?: string | null;
  returnPath: '/winback' | '/staff/winback';
}

export type LqsSalePrefill = LqsHouseholdSalePrefill;
