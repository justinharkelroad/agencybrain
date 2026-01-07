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
import { Loader2 } from 'lucide-react';
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
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [leadSourceId, setLeadSourceId] = useState('');
  const [productInterested, setProductInterested] = useState('');
  const [teamMemberId, setTeamMemberId] = useState(currentTeamMemberId || '');
  const [leadDate, setLeadDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setZipCode('');
    setPhone('');
    setEmail('');
    setLeadSourceId('');
    setProductInterested('');
    setTeamMemberId(currentTeamMemberId || '');
    setLeadDate(format(new Date(), 'yyyy-MM-dd'));
    setNotes('');
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
            phone: phone || null,
            email: email || null,
            lead_source_id: leadSourceId,
            team_member_id: teamMemberId || null,
            notes: notes || null,
            needs_attention: false,
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
            phone: phone || null,
            email: email || null,
            status: 'lead',
            lead_source_id: leadSourceId,
            team_member_id: teamMemberId || null,
            needs_attention: false,
            notes: notes || null,
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

          {/* Product Interested */}
          <div className="space-y-2">
            <Label htmlFor="product">Product Interested</Label>
            <Select value={productInterested} onValueChange={setProductInterested}>
              <SelectTrigger>
                <SelectValue placeholder="Select product..." />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {PRODUCT_OPTIONS.map((product) => (
                  <SelectItem key={product} value={product}>
                    {product}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
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
              'Add Lead'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
