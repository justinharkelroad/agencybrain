import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format, parse } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Upload, 
  FileText, 
  Loader2, 
  CalendarIcon, 
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExtractedSaleData {
  customerName: string;
  customerZip: string;
  policyNumber: string;
  effectiveDate: string;
  expirationDate: string;
  premium: number;
  productType: string;
  itemCount: number;
  vehicles?: string[];
  confidence: 'high' | 'medium' | 'low';
}

interface ProductType {
  id: string;
  name: string;
  category: string;
  default_points: number | null;
  is_vc_item: boolean | null;
}

interface TeamMember {
  id: string;
  name: string;
}

interface PdfUploadFormProps {
  onSuccess?: () => void;
  agencyId?: string | null;
  // Staff portal props
  staffSessionToken?: string;
  staffUserId?: string;
  staffTeamMemberId?: string | null;
}

// Auto products for Preferred Bundle detection
const AUTO_PRODUCTS = ['Standard Auto', 'Non-Standard Auto', 'Specialty Auto'];
const HOME_PRODUCTS = ['Homeowners', 'North Light Homeowners', 'Condo', 'North Light Condo'];

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
  'personal umbrella': 'Personal Umbrella',
  'boat': 'Boatowners',
  'boatowners': 'Boatowners',
};

function matchProductType(extracted: string, productTypes: ProductType[]): ProductType | null {
  const normalized = extracted.toLowerCase().trim();
  const mappedName = PRODUCT_TYPE_MAPPING[normalized] || extracted;
  return productTypes.find(pt => 
    pt.name.toLowerCase() === mappedName.toLowerCase()
  ) || null;
}

export function PdfUploadForm({
  onSuccess,
  agencyId,
  staffSessionToken,
  staffUserId,
  staffTeamMemberId,
}: PdfUploadFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // More robust staff mode detection - check both session token and team member ID
  const isStaffMode = !!staffSessionToken || !!staffTeamMemberId;

  // Fetch profile for agency_id (admin mode)
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
  const [filename, setFilename] = useState<string>('');
  const [extractedData, setExtractedData] = useState<ExtractedSaleData | null>(null);

  // Form state for review/edit
  const [customerName, setCustomerName] = useState('');
  const [customerZip, setCustomerZip] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [effectiveDate, setEffectiveDate] = useState<Date | undefined>();
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();
  const [premium, setPremium] = useState<string>('');
  const [productTypeId, setProductTypeId] = useState('');
  const [itemCount, setItemCount] = useState(1);
  const [producerId, setProducerId] = useState('');

  // Fetch product types
  const { data: productTypes = [] } = useQuery<ProductType[]>({
    queryKey: ["product-types", effectiveAgencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_types")
        .select("id, name, category, default_points, is_vc_item")
        .or(`agency_id.is.null,agency_id.eq.${effectiveAgencyId}`)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveAgencyId,
  });

  // Fetch team members (admin only)
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["team-members", effectiveAgencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name")
        .eq("agency_id", effectiveAgencyId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveAgencyId && !isStaffMode,
  });

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
      
      return data.data as ExtractedSaleData;
    },
    onSuccess: (data) => {
      setExtractedData(data);
      
      // Populate form with extracted data
      setCustomerName(data.customerName || '');
      setCustomerZip(data.customerZip || '');
      setPolicyNumber(data.policyNumber || '');
      
      // Parse dates
      if (data.effectiveDate) {
        try {
          setEffectiveDate(new Date(data.effectiveDate));
        } catch {
          // Ignore invalid date
        }
      }
      if (data.expirationDate) {
        try {
          setExpirationDate(new Date(data.expirationDate));
        } catch {
          // Ignore invalid date
        }
      }
      
      setPremium(data.premium?.toString() || '');
      setItemCount(data.itemCount || 1);

      // Match product type
      const matched = matchProductType(data.productType, productTypes);
      if (matched) {
        setProductTypeId(matched.id);
      }

      setUploadState('review');
      toast.success('PDF parsed successfully!');
    },
    onError: (error) => {
      console.error('PDF parse error:', error);
      toast.error(error.message || 'Failed to parse PDF');
      setUploadState('idle');
    },
  });

  // Create sale mutation
  const createSale = useMutation({
    mutationFn: async () => {
      if (!effectiveDate) throw new Error('Effective date is required');
      if (!customerName.trim()) throw new Error('Customer name is required');
      if (!productTypeId) throw new Error('Product type is required');

      const selectedProduct = productTypes.find(pt => pt.id === productTypeId);
      if (!selectedProduct) throw new Error('Invalid product type');

      const premiumValue = parseFloat(premium) || 0;
      const points = (selectedProduct.default_points || 0) * itemCount;
      const isVcQualifying = selectedProduct.is_vc_item || false;

      // Detect bundle type
      const productName = selectedProduct.name;
      const hasAuto = AUTO_PRODUCTS.some(a => productName.toLowerCase() === a.toLowerCase());
      const hasHome = HOME_PRODUCTS.some(h => productName.toLowerCase() === h.toLowerCase());
      const isBundle = false; // Single policy from PDF
      const bundleType = null;

      const salePayload = {
        customer_name: customerName.trim(),
        customer_zip: customerZip || null,
        sale_date: format(new Date(), 'yyyy-MM-dd'),
        effective_date: format(effectiveDate, 'yyyy-MM-dd'),
        expiration_date: expirationDate ? format(expirationDate, 'yyyy-MM-dd') : null,
        source: 'pdf_upload',
        source_details: {
          filename,
          extracted_at: new Date().toISOString(),
          confidence: extractedData?.confidence || 'low',
        },
        total_policies: 1,
        total_items: itemCount,
        total_premium: premiumValue,
        total_points: points,
        is_vc_qualifying: isVcQualifying,
        vc_items: isVcQualifying ? itemCount : 0,
        vc_premium: isVcQualifying ? premiumValue : 0,
        vc_points: isVcQualifying ? points : 0,
        is_bundle: isBundle,
        bundle_type: bundleType,
        policies: [{
          product_type_id: productTypeId,
          policy_type_name: selectedProduct.name,
          policy_number: policyNumber || undefined,
          effective_date: format(effectiveDate, 'yyyy-MM-dd'),
          is_vc_qualifying: isVcQualifying,
          items: [{
            product_type_id: productTypeId,
            product_type_name: selectedProduct.name,
            item_count: itemCount,
            premium: premiumValue,
            points: points,
            is_vc_qualifying: isVcQualifying,
          }]
        }]
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
            customer_name: customerName.trim(),
            customer_zip: customerZip || null,
            sale_date: format(new Date(), 'yyyy-MM-dd'),
            effective_date: format(effectiveDate, 'yyyy-MM-dd'),
            total_policies: 1,
            total_items: itemCount,
            total_premium: premiumValue,
            total_points: points,
            is_vc_qualifying: isVcQualifying,
            vc_items: isVcQualifying ? itemCount : 0,
            vc_premium: isVcQualifying ? premiumValue : 0,
            vc_points: isVcQualifying ? points : 0,
            is_bundle: isBundle,
            bundle_type: bundleType,
            source: 'pdf_upload',
            source_details: {
              filename,
              extracted_at: new Date().toISOString(),
              confidence: extractedData?.confidence || 'low',
            },
            created_by: user?.id,
          })
          .select('id')
          .single();

        if (saleError) throw saleError;

        // Create policy
        const { data: createdPolicy, error: policyError } = await supabase
          .from('sale_policies')
          .insert({
            sale_id: sale.id,
            product_type_id: productTypeId,
            policy_type_name: selectedProduct.name,
            policy_number: policyNumber || null,
            effective_date: format(effectiveDate, 'yyyy-MM-dd'),
            total_items: itemCount,
            total_premium: premiumValue,
            total_points: points,
            is_vc_qualifying: isVcQualifying,
          })
          .select('id')
          .single();

        if (policyError) throw policyError;

        // Create line item
        const { error: itemError } = await supabase
          .from('sale_items')
          .insert({
            sale_id: sale.id,
            sale_policy_id: createdPolicy.id,
            product_type_id: productTypeId,
            product_type_name: selectedProduct.name,
            item_count: itemCount,
            premium: premiumValue,
            points: points,
            is_vc_qualifying: isVcQualifying,
          });

        if (itemError) throw itemError;

        return { sale_id: sale.id };
      }
    },
    onSuccess: () => {
      toast.success('Sale created successfully!');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['staff-sales'] });
      resetForm();
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Create sale error:', error);
      toast.error(error.message || 'Failed to create sale');
    },
  });

  const resetForm = () => {
    setUploadState('idle');
    setFilename('');
    setExtractedData(null);
    setCustomerName('');
    setCustomerZip('');
    setPolicyNumber('');
    setEffectiveDate(undefined);
    setExpirationDate(undefined);
    setPremium('');
    setProductTypeId('');
    setItemCount(1);
    setProducerId('');
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

    setFilename(file.name);
    setUploadState('uploading');
    parsePdf.mutate(file);
  }, [parsePdf]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: uploadState !== 'idle'
  });

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return <Badge variant="default" className="bg-green-500">High Confidence</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-yellow-500 text-black">Medium Confidence</Badge>;
      default:
        return <Badge variant="destructive">Low Confidence</Badge>;
    }
  };

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
              Supports Allstate Purchase Confirmation PDFs (max 10MB)
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (uploadState === 'uploading') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processing PDF</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">Extracting data from {filename}...</p>
          <p className="text-sm text-muted-foreground mt-2">
            This may take a few seconds
          </p>
        </CardContent>
      </Card>
    );
  }

  // Review state
  return (
    <div className="space-y-6">
      {/* Extraction Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">{filename}</CardTitle>
              <p className="text-sm text-muted-foreground">Review and edit extracted data</p>
            </div>
          </div>
          {extractedData && getConfidenceBadge(extractedData.confidence)}
        </CardHeader>
      </Card>

      {/* Edit Form */}
      <form onSubmit={(e) => { e.preventDefault(); createSale.mutate(); }}>
        <div className="grid gap-6">
          {/* Customer Info */}
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
                  className={cn(
                    !customerName && extractedData?.confidence === 'low' && "border-yellow-500"
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerZip">Zip Code</Label>
                <Input
                  id="customerZip"
                  value={customerZip}
                  onChange={(e) => setCustomerZip(e.target.value)}
                  placeholder="12345"
                  maxLength={10}
                />
              </div>
            </CardContent>
          </Card>

          {/* Policy Details */}
          <Card>
            <CardHeader>
              <CardTitle>Policy Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="productType">
                  Product Type <span className="text-destructive">*</span>
                </Label>
                <Select value={productTypeId} onValueChange={setProductTypeId} required>
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
                <Label htmlFor="policyNumber">Policy Number</Label>
                <Input
                  id="policyNumber"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  placeholder="123456789"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Effective Date <span className="text-destructive">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !effectiveDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {effectiveDate ? format(effectiveDate, "MMM d, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={effectiveDate}
                      onSelect={setEffectiveDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Expiration Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !expirationDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expirationDate ? format(expirationDate, "MMM d, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expirationDate}
                      onSelect={setExpirationDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="premium">Premium ($)</Label>
                <Input
                  id="premium"
                  type="number"
                  step="0.01"
                  value={premium}
                  onChange={(e) => setPremium(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itemCount">Item Count</Label>
                <Input
                  id="itemCount"
                  type="number"
                  min="1"
                  value={itemCount}
                  onChange={(e) => setItemCount(parseInt(e.target.value) || 1)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Producer Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Producer</CardTitle>
            </CardHeader>
            <CardContent>
              {isStaffMode ? (
                <p className="text-sm text-muted-foreground">
                  This sale will be assigned to you automatically.
                </p>
              ) : (
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
            </CardContent>
          </Card>

          {/* Vehicles (if extracted) */}
          {extractedData?.vehicles && extractedData.vehicles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Vehicles Detected</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {extractedData.vehicles.map((vehicle, i) => (
                    <li key={i} className="text-sm">{vehicle}</li>
                  ))}
                </ul>
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
              type="submit"
              disabled={createSale.isPending || !customerName || !productTypeId || !effectiveDate}
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
                  Create Sale
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
