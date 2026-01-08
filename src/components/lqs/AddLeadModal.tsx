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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LqsLeadSource } from '@/hooks/useLqsData';
import { format } from 'date-fns';

interface AddLeadModalProps {
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

export function AddLeadModal({
  open,
  onOpenChange,
  agencyId,
  leadSources,
  teamMembers,
  currentTeamMemberId,
  onSuccess,
}: AddLeadModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [phones, setPhones] = useState<string[]>(['']);
  const [email, setEmail] = useState('');
  const [leadSourceId, setLeadSourceId] = useState('');
  const [productsInterested, setProductsInterested] = useState<string[]>([]);
  const [teamMemberId, setTeamMemberId] = useState(currentTeamMemberId || '');
  const [leadDate, setLeadDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setZipCode('');
    setPhones(['']);
    setEmail('');
    setLeadSourceId('');
    setProductsInterested([]);
    setTeamMemberId(currentTeamMemberId || '');
    setLeadDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleAddPhone = () => {
    setPhones([...phones, '']);
  };

  const handleRemovePhone = (index: number) => {
    if (phones.length > 1) {
      setPhones(phones.filter((_, i) => i !== index));
    }
  };

  const handlePhoneChange = (index: number, value: string) => {
    const newPhones = [...phones];
    newPhones[index] = value;
    setPhones(newPhones);
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
    if (!leadSourceId) {
      toast.error('Lead source is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate household key
      const householdKey = `${lastName.trim().toUpperCase()}_${firstName.trim().toUpperCase()}_${zipCode.trim()}`;

      // Clean phone array (remove empty values)
      const cleanedPhones = phones.filter(p => p.trim() !== '');

      // Check if household exists
      const { data: existingHousehold } = await supabase
        .from('lqs_households')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('household_key', householdKey)
        .maybeSingle();

      if (existingHousehold) {
        // Update existing household
        const { error: updateError } = await supabase
          .from('lqs_households')
          .update({
            phone: cleanedPhones.length > 0 ? cleanedPhones : null,
            email: email || null,
            lead_source_id: leadSourceId,
            team_member_id: teamMemberId || null,
            needs_attention: false,
            products_interested: productsInterested.length > 0 ? productsInterested : null,
          })
          .eq('id', existingHousehold.id);

        if (updateError) throw updateError;
        toast.success('Lead updated successfully');
      } else {
        // Create new household
        const { error: insertError } = await supabase
          .from('lqs_households')
          .insert({
            agency_id: agencyId,
            household_key: householdKey,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            zip_code: zipCode.trim(),
            phone: cleanedPhones.length > 0 ? cleanedPhones : null,
            email: email || null,
            status: 'lead',
            lead_source_id: leadSourceId,
            team_member_id: teamMemberId || null,
            needs_attention: false,
            lead_received_date: leadDate,
            products_interested: productsInterested.length > 0 ? productsInterested : null,
          });

        if (insertError) throw insertError;
        toast.success('Lead added successfully');
      }

      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding lead:', error);
      toast.error('Failed to add lead');
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
          <DialogTitle>Add Lead</DialogTitle>
          <DialogDescription>
            Enter lead information. First name, last name, ZIP code, and lead source are required.
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

          {/* Phone Numbers */}
          <div className="space-y-2">
            <Label>Phone Numbers</Label>
            <div className="space-y-2">
              {phones.map((phone, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={phone}
                    onChange={(e) => handlePhoneChange(index, e.target.value)}
                    placeholder={index === 0 ? "(555) 123-4567" : `Phone ${index + 1}`}
                  />
                  {phones.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() => handleRemovePhone(index)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={handleAddPhone}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Another Phone
              </Button>
            </div>
          </div>

          {/* Email */}
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

          {/* Lead Source */}
          <div className="space-y-2">
            <Label htmlFor="leadSource">
              Lead Source <span className="text-destructive">*</span>
            </Label>
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

          {/* Products Interested */}
          <div className="space-y-3">
            <Label>Products Interested</Label>
            <div className="grid grid-cols-2 gap-2">
              {PRODUCT_OPTIONS.map((product) => (
                <div key={product} className="flex items-center space-x-2">
                  <Checkbox
                    id={`product-${product}`}
                    checked={productsInterested.includes(product)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setProductsInterested([...productsInterested, product]);
                      } else {
                        setProductsInterested(productsInterested.filter(p => p !== product));
                      }
                    }}
                  />
                  <Label htmlFor={`product-${product}`} className="text-sm font-normal cursor-pointer">
                    {product}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Sub-Producer & Lead Date */}
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="leadDate">Lead Date</Label>
              <Input
                id="leadDate"
                type="date"
                value={leadDate}
                onChange={(e) => setLeadDate(e.target.value)}
              />
            </div>
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
              'Add Lead'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}