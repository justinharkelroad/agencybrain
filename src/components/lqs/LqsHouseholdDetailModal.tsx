import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Pencil,
  X,
  Check,
  Mail,
  Phone,
  MapPin,
  User,
  Calendar,
  FileText,
  Tag,
} from 'lucide-react';
import { HouseholdWithRelations } from '@/hooks/useLqsData';

interface LqsHouseholdDetailModalProps {
  household: HouseholdWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignLeadSource?: (householdId: string) => void;
}

export function LqsHouseholdDetailModal({
  household,
  open,
  onOpenChange,
  onAssignLeadSource,
}: LqsHouseholdDetailModalProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Reset edit state when household changes
  useEffect(() => {
    if (household) {
      setEditPhone(household.phone || '');
      setEditEmail(household.email || '');
      setIsEditing(false);
    }
  }, [household]);

  const handleSave = async () => {
    if (!household) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('lqs_households')
        .update({
          phone: editPhone || null,
          email: editEmail || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', household.id);

      if (error) throw error;

      toast.success('Saved');
      setIsEditing(false);
      // Invalidate to refresh the data
      queryClient.invalidateQueries({ queryKey: ['lqs-data'] });
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditPhone(household?.phone || '');
    setEditEmail(household?.email || '');
    setIsEditing(false);
  };

  if (!household) return null;

  const totalPremium = household.quotes?.reduce((sum, q) => sum + (q.premium_cents || 0), 0) || 0;
  const uniqueProducts = [...new Set(household.quotes?.map(q => q.product_type) || [])];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Household Details</span>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Info Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {household.last_name.toUpperCase()}, {household.first_name}
              </h3>
              <div className="flex items-center gap-2">
                <Badge
                  variant={household.status === 'sold' ? 'default' : 'secondary'}
                >
                  {household.status.charAt(0).toUpperCase() + household.status.slice(1)}
                </Badge>
                {household.needs_attention && (
                  <Badge variant="destructive">Needs Attention</Badge>
                )}
              </div>
            </div>

            {/* Contact Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {/* Phone */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 flex-shrink-0" />
                {isEditing ? (
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="h-8"
                  />
                ) : (
                  <span>{household.phone || '—'}</span>
                )}
              </div>

              {/* Email */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 flex-shrink-0" />
                {isEditing ? (
                  <Input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Email (optional)"
                    className="h-8"
                  />
                ) : (
                  <span>{household.email || '—'}</span>
                )}
              </div>

              {/* ZIP */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span>{household.zip_code || '—'}</span>
              </div>

              {/* Producer */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4 flex-shrink-0" />
                <span>{household.team_member?.name || '—'}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Lead Source Section */}
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Lead Source
            </h4>
            {household.lead_source ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {household.lead_source.name}
                </Badge>
                {household.lead_source.bucket && (
                  <span className="text-sm text-muted-foreground">
                    ({household.lead_source.bucket.name})
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-sm">Not assigned</span>
                {onAssignLeadSource && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onAssignLeadSource(household.id);
                      onOpenChange(false);
                    }}
                  >
                    Assign Lead Source
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Quotes Section */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Quotes ({household.quotes?.length || 0})
            </h4>

            {household.quotes?.length ? (
              <div className="space-y-3">
                {household.quotes.map((quote) => (
                  <Card key={quote.id}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{quote.product_type}</Badge>
                        </div>
                        <div className="text-base font-semibold">
                          ${((quote.premium_cents || 0) / 100).toLocaleString()}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3">
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          Quote: {quote.quote_date
                            ? format(parseISO(quote.quote_date), 'MMM d, yyyy')
                            : '—'}
                        </div>
                        {quote.issued_policy_number && (
                          <div className="text-green-600 dark:text-green-400 font-medium">
                            Policy: {quote.issued_policy_number}
                          </div>
                        )}
                        {quote.issued_policy_number && (
                          <div className="col-span-2 text-green-600 dark:text-green-400 font-medium">
                            Policy: {quote.issued_policy_number}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No quotes recorded.</p>
            )}
          </div>

          <Separator />

          {/* Totals Section */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold">{household.quotes?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Quotes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{uniqueProducts.length}</div>
              <div className="text-sm text-muted-foreground">Products</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                ${(totalPremium / 100).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Premium</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
