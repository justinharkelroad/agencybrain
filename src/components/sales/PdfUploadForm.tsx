import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLeadSources } from "@/hooks/useLeadSources";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ApplySequenceModal } from "@/components/onboarding/ApplySequenceModal";
import { BreakupLetterModal } from "@/components/sales/BreakupLetterModal";
import { 
  Upload, 
  FileText, 
  Loader2, 
  CalendarIcon, 
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Pencil,
  Package,
  Car,
  Home,
  AlertTriangle,
  Users
} from "lucide-react";
import { cn, todayLocal, formatPhoneNumber } from "@/lib/utils";

interface ExtractedSaleData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerZip: string;
  policyNumber: string;
  effectiveDate: string;
  premium: number;
  productType: string;
  itemCount: number;
  vehicles?: string[];
  confidence: 'high' | 'medium' | 'low';
}

interface StagedPolicy {
  id: string; // unique identifier for UI
  productTypeId: string;
  productTypeName: string;
  policyNumber: string;
  effectiveDate: Date | undefined;
  premium: number;
  itemCount: number;
  vehicles?: string[];
  confidence: 'high' | 'medium' | 'low';
  filename: string;
}

interface ProductType {
  id: string;
  name: string;
  allow_multiple_items: boolean;
  category: string;
  default_points: number | null;
  is_vc_item: boolean | null;
  canonical_name: string | null; // From linked product_types, used for matching
}

interface ProductTypeLinkedRecord {
  name: string | null;
  category: string | null;
  default_points: number | null;
  is_vc_item: boolean | null;
}

interface PolicyTypeQueryRow {
  id: string;
  name: string;
  allow_multiple_items: boolean | null;
  product_type: ProductTypeLinkedRecord | ProductTypeLinkedRecord[] | null;
}

interface TeamMember {
  id: string;
  name: string;
}

interface PdfUploadFormProps {
  onSuccess?: () => void;
  onSwitchToManual?: () => void;
  agencyId?: string | null;
  // Staff portal props
  staffSessionToken?: string;
  staffUserId?: string;
  staffTeamMemberId?: string | null;
  leadSources?: { id: string; name: string }[];
}

// Auto products for Preferred Bundle detection
const AUTO_PRODUCTS = ['Standard Auto', 'Non-Standard Auto', 'Specialty Auto'];
const HOME_PRODUCTS = ['Homeowners', 'North Light Homeowners', 'Condo', 'North Light Condo'];
const DEFAULT_MULTI_ITEM_PRODUCTS = [
  'Standard Auto',
  'Non-Standard Auto',
  'Specialty Auto',
  'Boatowners',
  'Motorcycle',
  'Off-Road Vehicle',
];

const detectBundleType = (
  policyProductNames: string[],
  existingTypes: string[] = []
): { isBundle: boolean; bundleType: string | null } => {
  const hasAuto = policyProductNames.some(name =>
    AUTO_PRODUCTS.some(auto => name.toLowerCase() === auto.toLowerCase())
  ) || existingTypes.includes('auto');

  const hasHome = policyProductNames.some(name =>
    HOME_PRODUCTS.some(home => name.toLowerCase() === home.toLowerCase())
  ) || existingTypes.includes('home');

  if (hasAuto && hasHome) {
    return { isBundle: true, bundleType: 'Preferred' };
  }

  const totalPolicies = policyProductNames.filter(Boolean).length + existingTypes.length;
  if (totalPolicies > 1) {
    return { isBundle: true, bundleType: 'Standard' };
  }

  return { isBundle: false, bundleType: null };
};

// Product type mapping for normalization
const PRODUCT_TYPE_MAPPING: Record<string, string> = {
  'auto': 'Standard Auto',
  'your auto policy': 'Standard Auto',
  'standard auto': 'Standard Auto',
  'home': 'Homeowners',
  'your home policy': 'Homeowners',
  'homeowners': 'Homeowners',
  'renters': 'Renters',
  'your renters policy': 'Renters',
  'condo': 'Condo',
  'your condo policy': 'Condo',
  'umbrella': 'Personal Umbrella',
  'pup': 'Personal Umbrella',
  'personal umbrella policy': 'Personal Umbrella',
  'personal umbrella': 'Personal Umbrella',
  'llp': 'Landlord Package',
  'landlord': 'Landlord Package',
  'landlord package': 'Landlord Package',
  'landlord package policy': 'Landlord Package',
  'motorcycle': 'Motorcycle',
  'mc': 'Motorcycle',
  'boat': 'Boatowners',
  'boatowners': 'Boatowners',
  'off road vehicle': 'Off-Road Vehicle',
  'off-road vehicle': 'Off-Road Vehicle',
  'atv': 'Off-Road Vehicle',
};

// Icon mapping for product types
const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  'Standard Auto': <Car className="h-4 w-4" />,
  'Non-Standard Auto': <Car className="h-4 w-4" />,
  'Specialty Auto': <Car className="h-4 w-4" />,
  'Homeowners': <Home className="h-4 w-4" />,
  'North Light Homeowners': <Home className="h-4 w-4" />,
  'Condo': <Home className="h-4 w-4" />,
  'North Light Condo': <Home className="h-4 w-4" />,
  'Renters': <Home className="h-4 w-4" />,
};

function matchProductType(extracted: string, productTypes: ProductType[]): ProductType | null {
  const normalized = extracted.toLowerCase().trim();
  const mappedName = PRODUCT_TYPE_MAPPING[normalized] || extracted;
  const normalizePolicyLabel = (value: string | null | undefined) =>
    (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  // 1) Exact canonical/display match
  const exact = productTypes.find(pt =>
    (pt.canonical_name && normalizePolicyLabel(pt.canonical_name) === normalizePolicyLabel(mappedName)) ||
    normalizePolicyLabel(pt.name) === normalizePolicyLabel(mappedName)
  );
  if (exact) return exact;

  // 2) Substring match to tolerate labels like "Landlord Package Policy"
  const contains = productTypes.find(pt => {
    const canonical = normalizePolicyLabel(pt.canonical_name);
    const display = normalizePolicyLabel(pt.name);
    const normalizedMapped = normalizePolicyLabel(mappedName);
    return (
      (!!canonical && (canonical.includes(normalizedMapped) || normalizedMapped.includes(canonical))) ||
      display.includes(normalizedMapped) ||
      normalizedMapped.includes(display)
    );
  });
  if (contains) return contains;

  // 3) Last attempt on raw extracted text
  return productTypes.find(pt =>
    (pt.canonical_name && normalizePolicyLabel(pt.canonical_name).includes(normalized)) ||
    normalizePolicyLabel(pt.name).includes(normalized)
  ) || null;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function isMultiItemProduct(productType?: ProductType | null): boolean {
  if (!productType) return false;
  if (typeof productType.allow_multiple_items === 'boolean') {
    return productType.allow_multiple_items;
  }
  const nameToCheck = productType.canonical_name || productType.name;
  return DEFAULT_MULTI_ITEM_PRODUCTS.some(
    (name) => nameToCheck.toLowerCase() === name.toLowerCase()
  );
}

export function PdfUploadForm({
  onSuccess,
  onSwitchToManual,
  agencyId,
  staffSessionToken,
  staffUserId,
  staffTeamMemberId,
  leadSources: staffLeadSources = [],
}: PdfUploadFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // More robust staff mode detection - check both session token and team member ID
  const isStaffMode = !!staffSessionToken || !!staffTeamMemberId;

  // Fetch lead sources for admin mode
  const { leadSources: adminLeadSources } = useLeadSources();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !isStaffMode,
  });

  const effectiveAgencyId = agencyId || profile?.agency_id;

  // State
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'review'>('idle');
  const [currentFilename, setCurrentFilename] = useState<string>('');
  const [showUploadDropzone, setShowUploadDropzone] = useState(false);

  // Multi-policy state
  const [stagedPolicies, setStagedPolicies] = useState<StagedPolicy[]>([]);

  // Shared customer info state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerZip, setCustomerZip] = useState('');
  const [producerId, setProducerId] = useState('');
  const [leadSourceId, setLeadSourceId] = useState('');
  const [hasExistingPolicies, setHasExistingPolicies] = useState(false);
  const [existingPolicyTypes, setExistingPolicyTypes] = useState<string[]>([]);

  // Edit modal state
  const [editingPolicy, setEditingPolicy] = useState<StagedPolicy | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Edit form state (for modal)
  const [editProductTypeId, setEditProductTypeId] = useState('');
  const [editPolicyNumber, setEditPolicyNumber] = useState('');
  const [editEffectiveDate, setEditEffectiveDate] = useState<Date | undefined>();
  const [editPremium, setEditPremium] = useState('');
  const [editItemCount, setEditItemCount] = useState(1);

  // Customer name mismatch warning
  const [showNameMismatchWarning, setShowNameMismatchWarning] = useState(false);
  const [showPolicyTypeReviewDialog, setShowPolicyTypeReviewDialog] = useState(false);
  const [pendingPolicyData, setPendingPolicyData] = useState<{
    data: ExtractedSaleData;
    filename: string;
  } | null>(null);
  const [applySequenceModalOpen, setApplySequenceModalOpen] = useState(false);
  const [breakupChoiceModalOpen, setBreakupChoiceModalOpen] = useState(false);
  const [breakupLetterModalOpen, setBreakupLetterModalOpen] = useState(false);
  const [newSaleData, setNewSaleData] = useState<{
    saleId: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    customerZip?: string;
    breakupPolicies: Array<{
      id: string;
      policyTypeName: string;
      policyNumber: string;
      effectiveDate: string;
      carrierName: string;
    }>;
  } | null>(null);

  // Fetch policy types with linked product_types for comp fields
  const { data: productTypes = [] } = useQuery<ProductType[]>({
    queryKey: ["policy-types-for-pdf-upload", effectiveAgencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policy_types")
        .select(`
          id,
          name,
          allow_multiple_items,
          product_type:product_types(
            name,
            category,
            default_points,
            is_vc_item
          )
        `)
        .eq("agency_id", effectiveAgencyId)
        .eq("is_active", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return ((data || []) as PolicyTypeQueryRow[]).map(pt => {
        const linked = Array.isArray(pt.product_type) ? pt.product_type[0] : pt.product_type;
        return {
        id: pt.id,
        name: pt.name,
        allow_multiple_items: pt.allow_multiple_items ?? false,
        category: linked?.category || 'General',
        default_points: linked?.default_points ?? 0,
        is_vc_item: linked?.is_vc_item ?? false,
        canonical_name: linked?.name || null,
      };
    });
    },
    enabled: !!effectiveAgencyId,
  });

  // Fetch team members (admin only)
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["team-members-active", effectiveAgencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name")
        .eq("agency_id", effectiveAgencyId)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveAgencyId && !isStaffMode,
  });

  // Add policy to staged list
  const addPolicyToStaged = (data: ExtractedSaleData, filename: string) => {
    const matched = matchProductType(data.productType, productTypes);
    const supportsMultipleItems = isMultiItemProduct(matched);
    
    const newPolicy: StagedPolicy = {
      id: generateId(),
      productTypeId: matched?.id || '',
      productTypeName: matched?.name || data.productType,
      policyNumber: data.policyNumber || '',
      effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined,
      premium: data.premium || 0,
      itemCount: supportsMultipleItems ? (data.itemCount || 1) : 1,
      vehicles: data.vehicles,
      confidence: data.confidence,
      filename,
    };

    setStagedPolicies(prev => [...prev, newPolicy]);
    setShowUploadDropzone(false);
    setCurrentFilename('');
  };

  // Parse PDF mutation
  const parsePdf = useMutation({
    mutationFn: async (file: File) => {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('parse-sale-pdf', {
        body: { pdfBase64: base64, filename: file.name }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return { extractedData: data.data as ExtractedSaleData, filename: file.name };
    },
    onSuccess: ({ extractedData, filename }) => {
      // If this is the first policy, set customer info from it
      if (stagedPolicies.length === 0) {
        setCustomerName(extractedData.customerName || '');
        setCustomerEmail(extractedData.customerEmail || '');
        setCustomerPhone(formatPhoneNumber(extractedData.customerPhone || ''));
        setCustomerZip(extractedData.customerZip || '');
        addPolicyToStaged(extractedData, filename);
        setUploadState('review');
        toast.success('PDF parsed successfully!');
      } else {
        // Check if customer name differs
        const existingName = customerName.trim().toLowerCase();
        const newName = (extractedData.customerName || '').trim().toLowerCase();
        
        if (existingName && newName && existingName !== newName) {
          // Show warning and store pending data
          setPendingPolicyData({ data: extractedData, filename });
          setShowNameMismatchWarning(true);
        } else {
          addPolicyToStaged(extractedData, filename);
          toast.success('Policy added to bundle!');
        }
      }
      
      setUploadState('review');
    },
    onError: (error) => {
      console.error('PDF parse error:', error);
      toast.error(error.message || 'Failed to parse PDF');
      if (stagedPolicies.length === 0) {
        setUploadState('idle');
      } else {
        setShowUploadDropzone(false);
      }
    },
  });

  // Create sale mutation
  const createSale = useMutation({
    mutationFn: async () => {
      if (stagedPolicies.length === 0) throw new Error('At least one policy is required');
      if (!customerName.trim()) throw new Error('Customer name is required');
      if (!customerEmail.trim()) throw new Error('Email is required');
      if (!customerPhone.trim()) throw new Error('Phone number is required');
      if (!customerZip.trim()) throw new Error('Zip code is required');
      if (!leadSourceId) throw new Error('Lead source is required');

      // Validate each policy has required fields
      for (const policy of stagedPolicies) {
        if (!policy.productTypeId) throw new Error(`Product type is required for all policies`);
        if (!policy.effectiveDate) throw new Error(`Effective date is required for all policies`);
      }

      // Calculate totals
      const totalPremium = stagedPolicies.reduce((sum, p) => sum + (p.premium || 0), 0);
      const totalItems = stagedPolicies.reduce((sum, p) => sum + (p.itemCount || 0), 0);
      const totalPoints = stagedPolicies.reduce((sum, p) => {
        const pt = productTypes.find(t => t.id === p.productTypeId);
        return sum + ((pt?.default_points || 0) * p.itemCount);
      }, 0);

      const productNames = stagedPolicies.map(p => p.productTypeName);
      const bundleInfo = detectBundleType(
        productNames,
        hasExistingPolicies ? existingPolicyTypes : []
      );

      // Check if any policy is VC qualifying
      const isVcQualifying = stagedPolicies.some(p => {
        const pt = productTypes.find(t => t.id === p.productTypeId);
        return pt?.is_vc_item;
      });

      const vcItems = stagedPolicies.reduce((sum, p) => {
        const pt = productTypes.find(t => t.id === p.productTypeId);
        return sum + (pt?.is_vc_item ? p.itemCount : 0);
      }, 0);

      const vcPremium = stagedPolicies.reduce((sum, p) => {
        const pt = productTypes.find(t => t.id === p.productTypeId);
        return sum + (pt?.is_vc_item ? p.premium : 0);
      }, 0);

      const vcPoints = stagedPolicies.reduce((sum, p) => {
        const pt = productTypes.find(t => t.id === p.productTypeId);
        return sum + (pt?.is_vc_item ? (pt?.default_points || 0) * p.itemCount : 0);
      }, 0);

      // Use first policy's effective date for the sale
      const firstEffectiveDate = stagedPolicies[0].effectiveDate!;

      const policiesPayload = stagedPolicies.map(policy => {
        const pt = productTypes.find(t => t.id === policy.productTypeId)!;
        const points = (pt.default_points || 0) * policy.itemCount;
        const isVc = pt.is_vc_item || false;
        
        return {
          product_type_id: policy.productTypeId,
          policy_type_name: pt.name,
          policy_number: policy.policyNumber || undefined,
          effective_date: format(policy.effectiveDate!, 'yyyy-MM-dd'),
          is_vc_qualifying: isVc,
          items: [{
            product_type_id: policy.productTypeId,
            product_type_name: pt.name,
            item_count: policy.itemCount,
            premium: policy.premium,
            points: points,
            is_vc_qualifying: isVc,
          }]
        };
      });

      const salePayload = {
        lead_source_id: leadSourceId,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim(),
        customer_phone: customerPhone.trim(),
        customer_zip: customerZip.trim(),
        sale_date: format(todayLocal(), 'yyyy-MM-dd'),
        effective_date: format(firstEffectiveDate, 'yyyy-MM-dd'),
        source: 'pdf_upload',
        source_details: {
          filenames: stagedPolicies.map(p => p.filename),
          extracted_at: new Date().toISOString(),
          policy_count: stagedPolicies.length,
        },
        total_policies: stagedPolicies.length,
        total_items: totalItems,
        total_premium: totalPremium,
        total_points: totalPoints,
        is_vc_qualifying: isVcQualifying,
        vc_items: vcItems,
        vc_premium: vcPremium,
        vc_points: vcPoints,
        is_bundle: bundleInfo.isBundle,
        bundle_type: bundleInfo.bundleType,
        existing_customer_products: hasExistingPolicies ? existingPolicyTypes : [],
        policies: policiesPayload
      };

      if (isStaffMode) {
        // Use edge function for staff
        const { data, error } = await supabase.functions.invoke('create_staff_sale', {
          headers: { 'x-staff-session': staffSessionToken! },
          body: salePayload
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);
        
        return data;
      } else {
        // Direct insert for admin
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert({
            agency_id: effectiveAgencyId,
            team_member_id: producerId || null,
            lead_source_id: leadSourceId,
            customer_name: customerName.trim(),
            customer_email: customerEmail.trim(),
            customer_phone: customerPhone.trim(),
            customer_zip: customerZip.trim(),
            sale_date: format(todayLocal(), 'yyyy-MM-dd'),
            effective_date: format(firstEffectiveDate, 'yyyy-MM-dd'),
            total_policies: stagedPolicies.length,
            total_items: totalItems,
            total_premium: totalPremium,
            total_points: totalPoints,
            is_vc_qualifying: isVcQualifying,
            vc_items: vcItems,
            vc_premium: vcPremium,
            vc_points: vcPoints,
            is_bundle: bundleInfo.isBundle,
            bundle_type: bundleInfo.bundleType,
            existing_customer_products: hasExistingPolicies ? existingPolicyTypes : [],
            source: 'pdf_upload',
            source_details: {
              filenames: stagedPolicies.map(p => p.filename),
              extracted_at: new Date().toISOString(),
              policy_count: stagedPolicies.length,
            },
            created_by: user?.id,
          })
          .select('id')
          .single();

        if (saleError) throw saleError;

        // Create policies and items for each staged policy
        for (const policy of stagedPolicies) {
          const pt = productTypes.find(t => t.id === policy.productTypeId)!;
          const points = (pt.default_points || 0) * policy.itemCount;
          const isVc = pt.is_vc_item || false;

          const { data: createdPolicy, error: policyError } = await supabase
            .from('sale_policies')
            .insert({
              sale_id: sale.id,
              product_type_id: policy.productTypeId,
              policy_type_name: pt.name,
              policy_number: policy.policyNumber || null,
              effective_date: format(policy.effectiveDate!, 'yyyy-MM-dd'),
              total_items: policy.itemCount,
              total_premium: policy.premium,
              total_points: points,
              is_vc_qualifying: isVc,
            })
            .select('id')
            .single();

          if (policyError) throw policyError;

          const { error: itemError } = await supabase
            .from('sale_items')
            .insert({
              sale_id: sale.id,
              sale_policy_id: createdPolicy.id,
              product_type_id: policy.productTypeId,
              product_type_name: pt.name,
              item_count: policy.itemCount,
              premium: policy.premium,
              points: points,
              is_vc_qualifying: isVc,
            });

          if (itemError) throw itemError;
        }

        // Trigger sale notification email (fire and forget)
        if (profile?.agency_id) {
          supabase.functions.invoke('send-sale-notification', {
            body: { 
              sale_id: sale.id, 
              agency_id: profile.agency_id 
            }
          }).catch(err => {
            console.error('[PdfUploadForm] Failed to trigger sale notification:', err);
          });
        }

        return { sale_id: sale.id };
      }
    },
    onSuccess: (result) => {
      toast.success('Sale created successfully!');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['staff-sales'] });
      // Invalidate promo widgets so progress refreshes immediately
      queryClient.invalidateQueries({ queryKey: ['admin-promo-goals-widget'] });
      queryClient.invalidateQueries({ queryKey: ['promo-goals'] });
      queryClient.invalidateQueries({ queryKey: ['staff-promo-goals'] });

      const saleId = result?.sale_id;
      if (!saleId || !effectiveAgencyId) {
        resetForm();
        onSuccess?.();
        return;
      }

      const breakupPolicies = stagedPolicies.map((policy) => ({
        id: policy.id,
        policyTypeName: policy.productTypeName,
        policyNumber: "",
        effectiveDate: format(policy.effectiveDate || todayLocal(), "yyyy-MM-dd"),
        carrierName: "Prior Carrier",
      }));

      setNewSaleData({
        saleId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerZip: customerZip.trim() || undefined,
        breakupPolicies,
      });
      setBreakupChoiceModalOpen(true);
    },
    onError: (error) => {
      console.error('Create sale error:', error);
      toast.error(error.message || 'Failed to create sale');
    },
  });

  const resetForm = () => {
    setUploadState('idle');
    setCurrentFilename('');
    setStagedPolicies([]);
    setCustomerName('');
    setCustomerZip('');
    setProducerId('');
    setLeadSourceId('');
    setHasExistingPolicies(false);
    setExistingPolicyTypes([]);
    setShowUploadDropzone(false);
    setShowPolicyTypeReviewDialog(false);
    setEditingPolicy(null);
    setEditModalOpen(false);
  };

  const removePolicy = (policyId: string) => {
    setStagedPolicies(prev => prev.filter(p => p.id !== policyId));
    // If no policies left, go back to idle state
    if (stagedPolicies.length <= 1) {
      setUploadState('idle');
      setCustomerName('');
      setCustomerZip('');
    }
  };

  const openEditModal = (policy: StagedPolicy) => {
    setEditingPolicy(policy);
    setEditProductTypeId(policy.productTypeId);
    setEditPolicyNumber(policy.policyNumber);
    setEditEffectiveDate(policy.effectiveDate);
    setEditPremium(policy.premium.toString());
    setEditItemCount(policy.itemCount);
    setEditModalOpen(true);
  };

  // Add a blank policy for manual entry
  const addManualPolicy = () => {
    const blankPolicy: StagedPolicy = {
      id: generateId(),
      productTypeId: '',
      productTypeName: '',
      policyNumber: '',
      effectiveDate: undefined,
      premium: 0,
      itemCount: 1,
      confidence: 'high', // Manual entry is assumed accurate
      filename: 'Manual Entry',
    };
    
    setEditingPolicy(blankPolicy);
    setEditProductTypeId('');
    setEditPolicyNumber('');
    setEditEffectiveDate(undefined);
    setEditPremium('');
    setEditItemCount(1);
    setEditModalOpen(true);
    setShowUploadDropzone(false);
    
    // If this is the first policy, set to review state
    if (stagedPolicies.length === 0) {
      setUploadState('review');
    }
  };

  const saveEditedPolicy = () => {
    if (!editingPolicy) return;

    const pt = productTypes.find(t => t.id === editProductTypeId);
    const supportsMultipleItems = isMultiItemProduct(pt);
    const existingIndex = stagedPolicies.findIndex(p => p.id === editingPolicy.id);
    
    const updatedPolicy: StagedPolicy = {
      ...editingPolicy,
      productTypeId: editProductTypeId,
      productTypeName: pt?.name || '',
      policyNumber: editPolicyNumber,
      effectiveDate: editEffectiveDate,
      premium: parseFloat(editPremium) || 0,
      itemCount: supportsMultipleItems ? editItemCount : 1,
      // Treat manual edits as user-reviewed so confidence prompts do not persist unnecessarily.
      confidence: 'high',
    };
    
    if (existingIndex >= 0) {
      // Editing existing policy
      setStagedPolicies(prev => prev.map(p => 
        p.id === editingPolicy.id ? updatedPolicy : p
      ));
      toast.success('Policy updated');
    } else {
      // Adding new manual policy
      setStagedPolicies(prev => [...prev, updatedPolicy]);
      toast.success('Policy added manually');
    }

    setEditModalOpen(false);
    setEditingPolicy(null);
  };

  const handleNameMismatchContinue = () => {
    if (pendingPolicyData) {
      addPolicyToStaged(pendingPolicyData.data, pendingPolicyData.filename);
      toast.success('Policy added to bundle!');
    }
    setShowNameMismatchWarning(false);
    setPendingPolicyData(null);
  };

  const handleNameMismatchCancel = () => {
    setShowNameMismatchWarning(false);
    setPendingPolicyData(null);
    setShowUploadDropzone(false);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setCurrentFilename(file.name);
    setUploadState('uploading');
    parsePdf.mutate(file);
  }, [parsePdf]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: uploadState === 'uploading'
  });

  const productNames = stagedPolicies.map(p => p.productTypeName);
  const selectedEditProductType = productTypes.find((pt) => pt.id === editProductTypeId);
  const canEditMultipleItems = isMultiItemProduct(selectedEditProductType);
  const bundleInfo = detectBundleType(
    productNames,
    hasExistingPolicies ? existingPolicyTypes : []
  );

  useEffect(() => {
    if (selectedEditProductType && !canEditMultipleItems && editItemCount !== 1) {
      setEditItemCount(1);
    }
  }, [selectedEditProductType, canEditMultipleItems, editItemCount]);
  const bundleLabel = bundleInfo.bundleType
    ? `${bundleInfo.bundleType} Bundle: ${productNames.join(' + ')}`
    : null;

  const totalPremium = stagedPolicies.reduce((sum, p) => sum + (p.premium || 0), 0);
  const totalItems = stagedPolicies.reduce((sum, p) => sum + (p.itemCount || 0), 0);

  const getProductIcon = (productName: string) => {
    return PRODUCT_ICONS[productName] || <FileText className="h-4 w-4" />;
  };

  const getConfidenceMeta = (confidence: StagedPolicy['confidence']) => {
    if (confidence === 'high') {
      return { label: 'High confidence', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (confidence === 'medium') {
      return { label: 'Needs review', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    return { label: 'Low confidence', className: 'bg-red-50 text-red-700 border-red-200' };
  };

  const policiesNeedingTypeReview = stagedPolicies.filter((p) => p.confidence !== 'high');
  const hasPolicyTypeUncertainty = policiesNeedingTypeReview.length > 0;

  const handleCreateSaleClick = () => {
    if (hasPolicyTypeUncertainty) {
      setShowPolicyTypeReviewDialog(true);
      return;
    }
    createSale.mutate();
  };

  // Idle state - show initial upload dropzone
  if (uploadState === 'idle') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload Allstate Purchase Confirmation PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
              isDragActive 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/25 hover:border-primary/50"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              {isDragActive ? "Drop the PDF here" : "Drag & drop a PDF here"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to select a file
            </p>
            <p className="text-xs text-muted-foreground">
              Drop your New Business Application PDF here
            </p>
          </div>
          
          {/* Manual entry link */}
          {onSwitchToManual && (
            <div className="text-center mt-6">
              <span className="text-sm text-muted-foreground">or </span>
              <button
                type="button"
                onClick={onSwitchToManual}
                className="text-sm text-muted-foreground hover:text-primary hover:underline transition-colors"
              >
                Enter Sale Manually →
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Uploading state
  if (uploadState === 'uploading' && stagedPolicies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processing PDF</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">Extracting data from {currentFilename}...</p>
          <p className="text-sm text-muted-foreground mt-2">
            This may take a few seconds
          </p>
        </CardContent>
      </Card>
    );
  }

  // Review state - show staged policies and customer info
  return (
    <>
    <div className="space-y-6">
      {/* Customer Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customerName">
              Customer Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="John Smith"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerEmail">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="customerEmail"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="john@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone">
              Phone <span className="text-destructive">*</span>
            </Label>
            <Input
              id="customerPhone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(formatPhoneNumber(e.target.value))}
              placeholder="(555) 123-4567"
              maxLength={14}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerZip">
              Zip Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="customerZip"
              value={customerZip}
              onChange={(e) => setCustomerZip(e.target.value)}
              placeholder="12345"
              maxLength={10}
              required
            />
          </div>
          <div className="space-y-3 sm:col-span-2">
            <div className={cn(
              "p-4 rounded-lg border transition-colors",
              hasExistingPolicies
                ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20"
                : "border-muted bg-muted/30"
            )}>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="hasExistingPolicies"
                  checked={hasExistingPolicies}
                  onCheckedChange={(checked) => {
                    setHasExistingPolicies(checked === true);
                    if (!checked) {
                      setExistingPolicyTypes([]);
                    }
                  }}
                />
                <Label
                  htmlFor="hasExistingPolicies"
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
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="existingAuto"
                        checked={existingPolicyTypes.includes('auto')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setExistingPolicyTypes([...existingPolicyTypes, 'auto']);
                          } else {
                            setExistingPolicyTypes(existingPolicyTypes.filter(t => t !== 'auto'));
                          }
                        }}
                      />
                      <Label htmlFor="existingAuto" className="cursor-pointer">
                        Auto
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="existingHome"
                        checked={existingPolicyTypes.includes('home')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setExistingPolicyTypes([...existingPolicyTypes, 'home']);
                          } else {
                            setExistingPolicyTypes(existingPolicyTypes.filter(t => t !== 'home'));
                          }
                        }}
                      />
                      <Label htmlFor="existingHome" className="cursor-pointer">
                        Home/Property
                      </Label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="leadSource">
              Lead Source <span className="text-destructive">*</span>
            </Label>
            <Select value={leadSourceId} onValueChange={setLeadSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select lead source..." />
              </SelectTrigger>
              <SelectContent>
                {(isStaffMode ? staffLeadSources : adminLeadSources).map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isStaffMode && (
            <div className="space-y-2">
              <Label htmlFor="producer">Assign to Producer</Label>
              <Select value={producerId} onValueChange={setProducerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select producer" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isStaffMode && (
            <div className="space-y-2">
              <Label>Producer</Label>
              <p className="text-sm text-muted-foreground pt-2">
                This sale will be assigned to you automatically.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Policies Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Policies</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowUploadDropzone(true)}
            disabled={showUploadDropzone || uploadState === 'uploading'}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Policy
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Staged Policies List */}
          {stagedPolicies.map((policy) => (
            <div
              key={policy.id}
              className="border rounded-lg p-4 bg-muted/30"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {getProductIcon(policy.productTypeName)}
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {policy.productTypeName || 'Unknown Product'}
                      <Badge variant="outline" className={getConfidenceMeta(policy.confidence).className}>
                        {getConfidenceMeta(policy.confidence).label}
                      </Badge>
                      {!policy.productTypeId && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Select Type
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      {policy.policyNumber && (
                        <span>Policy: {policy.policyNumber}</span>
                      )}
                      {policy.effectiveDate && (
                        <span>Eff: {format(policy.effectiveDate, 'MM/dd/yyyy')}</span>
                      )}
                      <span>${policy.premium.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <span>{policy.itemCount} item{policy.itemCount !== 1 ? 's' : ''}</span>
                    </div>
                    {policy.confidence !== 'high' && (
                      <p className="text-xs text-amber-700 mt-2">
                        Please confirm policy type before saving. You can edit it if needed.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(policy)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePolicy(policy.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {/* Add Policy Dropzone (shown when user clicks "+ Add Policy") */}
          {showUploadDropzone && (
            <div className="border-2 border-dashed rounded-lg p-6 mt-4">
              {uploadState === 'uploading' ? (
                <div className="flex flex-col items-center py-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-sm font-medium">Extracting from {currentFilename}...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* PDF Upload Option */}
                  <div
                    {...getRootProps()}
                    className={cn(
                      "text-center cursor-pointer transition-colors p-4 rounded-lg border border-dashed hover:border-primary",
                      isDragActive ? "opacity-70 border-primary" : "border-muted-foreground/30"
                    )}
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {isDragActive ? "Drop the PDF here" : "Upload PDF"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Drop a PDF or click to select
                    </p>
                  </div>
                  
                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">or</span>
                    </div>
                  </div>
                  
                  {/* Manual Entry Option */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={addManualPolicy}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Enter Manually
                  </Button>
                </div>
              )}
              <div className="flex justify-center mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUploadDropzone(false)}
                  disabled={uploadState === 'uploading'}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {stagedPolicies.length === 0 && !showUploadDropzone && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No policies added yet</p>
              <p className="text-sm">Upload a PDF to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bundle Indicator & Totals */}
      {stagedPolicies.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            {bundleLabel && (
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-primary" />
                <Badge variant="secondary" className="text-sm">
                  {bundleLabel}
                </Badge>
              </div>
            )}
            <div className="flex justify-between items-center text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Total Premium</p>
                <p className="text-2xl font-bold">
                  ${totalPremium.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={resetForm}
          disabled={createSale.isPending}
        >
          Cancel
        </Button>
        <Button
          onClick={handleCreateSaleClick}
          disabled={
            createSale.isPending || 
            stagedPolicies.length === 0 || 
            !customerName.trim() || 
            !leadSourceId ||
            stagedPolicies.some(p => !p.productTypeId || !p.effectiveDate)
          }
          className="flex-1"
        >
          {createSale.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Sale...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Create Sale{stagedPolicies.length > 1 ? ` (${stagedPolicies.length} Policies)` : ''}
            </>
          )}
        </Button>
      </div>

      {hasPolicyTypeUncertainty && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          We are not fully confident about {policiesNeedingTypeReview.length} uploaded policy
          {policiesNeedingTypeReview.length > 1 ? ' types' : ' type'}. Please review before saving.
        </div>
      )}

      {/* Edit/Add Policy Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy && stagedPolicies.find(p => p.id === editingPolicy.id)
                ? 'Edit Policy'
                : 'Add Policy Manually'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Product Type <span className="text-destructive">*</span></Label>
              <Select value={editProductTypeId} onValueChange={setEditProductTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  {productTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Policy Number</Label>
              <Input
                value={editPolicyNumber}
                onChange={(e) => setEditPolicyNumber(e.target.value)}
                placeholder="123456789"
              />
            </div>
            <div className="space-y-2">
              <Label>Effective Date <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editEffectiveDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editEffectiveDate ? format(editEffectiveDate, "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editEffectiveDate}
                    onSelect={setEditEffectiveDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Premium ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPremium}
                  onChange={(e) => setEditPremium(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Item Count</Label>
                <Input
                  type="number"
                  min="1"
                  value={editItemCount}
                  onChange={(e) => setEditItemCount(parseInt(e.target.value) || 1)}
                  disabled={!!selectedEditProductType && !canEditMultipleItems}
                />
                {!!selectedEditProductType && !canEditMultipleItems && (
                  <p className="text-xs text-muted-foreground">
                    This policy type is configured as single-item in Admin settings.
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEditedPolicy} disabled={!editProductTypeId || !editEffectiveDate}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Name Mismatch Warning Dialog */}
      <Dialog open={showNameMismatchWarning} onOpenChange={setShowNameMismatchWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Customer Name Mismatch
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              The customer name from this PDF differs from the existing customer:
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-muted rounded">
                <span className="text-muted-foreground">Current:</span>
                <span className="font-medium">{customerName}</span>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span className="text-muted-foreground">New PDF:</span>
                <span className="font-medium">{pendingPolicyData?.data.customerName}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Do you want to add this policy to the same sale anyway?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleNameMismatchCancel}>
              Cancel
            </Button>
            <Button onClick={handleNameMismatchContinue}>
              Add Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Policy Type Review Dialog */}
      <Dialog open={showPolicyTypeReviewDialog} onOpenChange={setShowPolicyTypeReviewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Please confirm policy type
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              We are not fully confident about the detected policy type for the items below.
              Review or edit before saving.
            </p>
            <div className="space-y-2">
              {policiesNeedingTypeReview.map((policy) => (
                <div key={policy.id} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{policy.productTypeName || 'Unknown Product'}</span>
                    <Badge variant="outline" className={getConfidenceMeta(policy.confidence).className}>
                      {getConfidenceMeta(policy.confidence).label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Policy: {policy.policyNumber || 'N/A'} {policy.effectiveDate ? `• Eff ${format(policy.effectiveDate, 'MM/dd/yyyy')}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPolicyTypeReviewDialog(false)}>
              Review Fields
            </Button>
            <Button
              onClick={() => {
                setShowPolicyTypeReviewDialog(false);
                createSale.mutate();
              }}
              disabled={createSale.isPending}
            >
              Save Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    {newSaleData && effectiveAgencyId && (
      <ApplySequenceModal
        open={applySequenceModalOpen}
        onOpenChange={(open) => {
          setApplySequenceModalOpen(open);
          if (!open) {
            setNewSaleData(null);
            resetForm();
            onSuccess?.();
          }
        }}
        saleId={newSaleData.saleId}
        customerName={newSaleData.customerName}
        customerPhone={newSaleData.customerPhone}
        customerEmail={newSaleData.customerEmail}
        agencyId={effectiveAgencyId}
        staffSessionToken={staffSessionToken || null}
        onSuccess={() => {
          setNewSaleData(null);
          setApplySequenceModalOpen(false);
          resetForm();
          onSuccess?.();
        }}
      />
    )}

    {newSaleData && effectiveAgencyId && (
      <Dialog
        open={breakupChoiceModalOpen}
        onOpenChange={(open) => {
          setBreakupChoiceModalOpen(open);
          if (!open && !breakupLetterModalOpen) {
            setApplySequenceModalOpen(true);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Breakup Letter?</DialogTitle>
            <DialogDescription>
              Generate a cancellation letter before sequence assignment. You can skip this and continue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBreakupChoiceModalOpen(false);
                setApplySequenceModalOpen(true);
              }}
            >
              Skip for Now
            </Button>
            <Button
              type="button"
              onClick={() => {
                setBreakupLetterModalOpen(true);
                setBreakupChoiceModalOpen(false);
              }}
            >
              Generate Letter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

    {newSaleData && effectiveAgencyId && (
      <BreakupLetterModal
        open={breakupLetterModalOpen}
        onOpenChange={(open) => {
          setBreakupLetterModalOpen(open);
          if (!open) {
            setApplySequenceModalOpen(true);
          }
        }}
        agencyId={effectiveAgencyId}
        customerName={newSaleData.customerName}
        customerZip={newSaleData.customerZip}
        customerEmail={newSaleData.customerEmail}
        customerPhone={newSaleData.customerPhone}
        policies={newSaleData.breakupPolicies}
        sourceContext="sale_upload"
        onContinueToSequence={() => {
          setBreakupLetterModalOpen(false);
          setApplySequenceModalOpen(true);
        }}
      />
    )}
    </>
  );
}
