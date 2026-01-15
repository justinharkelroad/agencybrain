import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LqsLeadSource } from '@/hooks/useLqsData';
import { format } from 'date-fns';
interface AddQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  leadSources: LqsLeadSource[];
  teamMembers: { id: string; name: string }[];
  currentTeamMemberId?: string | null;
  onSuccess: () => void;
}

const PRODUCT_OPTIONS = [
  'Standard Auto',
  'Non-Standard Auto',
  'Homeowners',
  'Renters',
  'Condo',
  'Umbrella',
  'Life',
  'Motorcycle',
  'Boat',
  'RV',
  'Other',
];

interface ProductEntry {
  productType: string;
  premium: string;
}

export function AddQuoteModal({
  open,
  onOpenChange,
  agencyId,
  leadSources,
  teamMembers,
  currentTeamMemberId,
  onSuccess,
}: AddQuoteModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [products, setProducts] = useState<ProductEntry[]>([{ productType: '', premium: '' }]);
  const [quoteDate, setQuoteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [teamMemberId, setTeamMemberId] = useState(currentTeamMemberId || '');
  const [leadSourceId, setLeadSourceId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setZipCode('');
    setProducts([{ productType: '', premium: '' }]);
    setQuoteDate(format(new Date(), 'yyyy-MM-dd'));
    setTeamMemberId(currentTeamMemberId || '');
    setLeadSourceId('');
    setPhone('');
    setEmail('');
    setNotes('');
  };

  const addProduct = () => {
    setProducts([...products, { productType: '', premium: '' }]);
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const updateProduct = (index: number, field: keyof ProductEntry, value: string) => {
    const updated = [...products];
    updated[index][field] = value;
    setProducts(updated);
  };

  const handleSubmit = async () => {
    // Validation
    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!lastName.trim()) {
      toast.error('Last name is required');
      return;
    }
    if (!zipCode.trim() || zipCode.length !== 5) {
      toast.error('Valid 5-digit ZIP code is required');
      return;
    }
    
    // Validate all products
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.productType) {
        toast.error(`Product type is required for product ${i + 1}`);
        return;
      }
      if (!p.premium || isNaN(parseFloat(p.premium)) || parseFloat(p.premium) <= 0) {
        toast.error(`Valid premium is required for ${p.productType || `product ${i + 1}`}`);
        return;
      }
    }
    
    if (!quoteDate) {
      toast.error('Quote date is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate household key
      const householdKey = `${lastName.trim().toUpperCase()}_${firstName.trim().toUpperCase()}_${zipCode.trim()}`;

      // Find or create household
      const { data: existingHousehold } = await supabase
        .from('lqs_households')
        .select('id, status')
        .eq('agency_id', agencyId)
        .eq('household_key', householdKey)
        .maybeSingle();

      let householdId: string;

      if (existingHousehold) {
        householdId = existingHousehold.id;
        
        // Update household - change status to quoted if was lead
        const updates: Record<string, unknown> = {};
        if (existingHousehold.status === 'lead') {
          updates.status = 'quoted';
          updates.first_quote_date = quoteDate;
        }
        if (phone) updates.phone = phone;
        if (email) updates.email = email;
        if (leadSourceId) {
          updates.lead_source_id = leadSourceId;
          updates.needs_attention = false;
        }
        if (teamMemberId) updates.team_member_id = teamMemberId;
        if (notes) updates.notes = notes;

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('lqs_households')
            .update(updates)
            .eq('id', householdId);
          
          if (updateError) throw updateError;
        }
      } else {
        // Create new household
        const { data: newHousehold, error: insertError } = await supabase
          .from('lqs_households')
          .insert({
            agency_id: agencyId,
            household_key: householdKey,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            zip_code: zipCode.trim(),
            phone: phone || null,
            email: email || null,
            status: 'quoted',
            first_quote_date: quoteDate,
            lead_source_id: leadSourceId || null,
            team_member_id: teamMemberId || null,
            needs_attention: !leadSourceId,
            notes: notes || null,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        householdId = newHousehold.id;
      }

      // Create quote records for each product
      const quoteInserts = products.map((p) => ({
        household_id: householdId,
        agency_id: agencyId,
        product_type: p.productType,
        premium_cents: Math.round(parseFloat(p.premium) * 100),
        quote_date: quoteDate,
        team_member_id: teamMemberId || null,
        items_quoted: 1,
        source: 'manual' as const,
      }));

      const { error: quoteError } = await supabase
        .from('lqs_quotes')
        .insert(quoteInserts);

      if (quoteError) throw quoteError;

      const productCount = products.length;
      toast.success(`${productCount} quote${productCount > 1 ? 's' : ''} added successfully`);
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding quote:', error);
      toast.error('Failed to add quote');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group lead sources by bucket
  const groupedSources = leadSources.reduce((acc, source) => {
    const bucketName = source.bucket?.name || 'Unassigned';
    if (!acc[bucketName]) {
      acc[bucketName] = [];
    }
    acc[bucketName].push(source);
    return acc;
  }, {} as Record<string, LqsLeadSource[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Quoted Household</DialogTitle>
          <DialogDescription>
            Enter household quote information. You can add multiple products for the same household.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
              />
            </div>
          </div>

          {/* ZIP Code */}
          <div className="space-y-2">
            <Label htmlFor="zipCode">
              ZIP Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="zipCode"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="12345"
              maxLength={5}
            />
          </div>

          {/* Products Section */}
          <div className="space-y-3">
            <Label>
              Products <span className="text-destructive">*</span>
            </Label>
            
            {products.map((product, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Select 
                    value={product.productType} 
                    onValueChange={(value) => updateProduct(index, 'productType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {PRODUCT_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={product.premium}
                      onChange={(e) => updateProduct(index, 'premium', e.target.value)}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>
                {products.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProduct(index)}
                    className="h-10 w-10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addProduct}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Product
            </Button>
          </div>

          {/* Quote Date */}
          <div className="space-y-2">
            <Label htmlFor="quoteDate">
              Quote Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quoteDate"
              type="date"
              value={quoteDate}
              onChange={(e) => setQuoteDate(e.target.value)}
            />
          </div>

          {/* Sub-Producer */}
          <div className="space-y-2">
            <Label htmlFor="teamMember">Sub-Producer</Label>
            <Select value={teamMemberId} onValueChange={setTeamMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select producer..." />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {teamMembers.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No team members found
                  </div>
                ) : (
                  teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Lead Source */}
          <div className="space-y-2">
            <Label htmlFor="leadSource">Lead Source</Label>
            <Select value={leadSourceId} onValueChange={setLeadSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select lead source..." />
              </SelectTrigger>
              <SelectContent side="bottom" position="popper" className="max-h-[200px] bg-background z-50">
                {Object.entries(groupedSources).map(([bucketName, sources]) => (
                  <div key={bucketName}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {bucketName}
                    </div>
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contact Info Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this household..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              `Add ${products.length} Quote${products.length > 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
