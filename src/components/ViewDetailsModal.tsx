import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ViewDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  household: {
    id: string;
    submission_id: string;
    form_template_id: string;
    team_member_id: string;
    work_date: string;
    household_name: string;
    lead_source?: string | null;
    zip?: string | null;
    notes?: string | null;
    email?: string | null;
    phone?: string | null;
    items_quoted: number;
    policies_quoted: number;
    premium_potential_cents: number;
    is_final: boolean;
    is_late: boolean;
    created_at: string;
  } | null;
  teamMembers: Array<{id: string, name: string}>;
  leadSources: Array<{id: string, name: string}>;
}

export function ViewDetailsModal({ 
  isOpen, 
  onClose, 
  household, 
  teamMembers, 
  leadSources 
}: ViewDetailsModalProps) {
  if (!household) return null;

  const teamMemberName = teamMembers.find(m => m.id === household.team_member_id)?.name || 'Unknown';
  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Household Details: {household.household_name}</span>
            <div className="flex gap-2">
              {household.is_late && (
                <Badge variant="destructive" className="text-xs">
                  Late
                </Badge>
              )}
              {!household.is_final && (
                <Badge variant="outline" className="text-xs">
                  Superseded
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Work Date</label>
                <p className="font-medium">{household.work_date}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Staff Member</label>
                <p className="font-medium">{teamMemberName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Household Name</label>
                <p className="font-medium">{household.household_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Lead Source</label>
                <div className="flex items-center gap-2">
                  {household.lead_source === "Undefined" ? (
                    <Badge variant="outline" className="text-xs">
                      Undefined
                    </Badge>
                  ) : (
                    <p className="font-medium">{household.lead_source || "—"}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="font-medium">{household.email || "—"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Phone</label>
                <p className="font-medium">{household.phone || "—"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">ZIP Code</label>
                <p className="font-medium">{household.zip || "—"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Financial Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Financial Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Items Quoted</label>
                <p className="text-2xl font-bold text-primary">{household.items_quoted || 0}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Policies Quoted</label>
                <p className="text-2xl font-bold text-primary">{household.policies_quoted || 0}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Premium Potential</label>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(household.premium_potential_cents || 0)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {household.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap break-words p-4 bg-muted/50 rounded-md">
                  {household.notes}
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Technical Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Technical Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Household ID</label>
                <p className="font-mono text-xs">{household.id}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Submission ID</label>
                <p className="font-mono text-xs">{household.submission_id}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Created At</label>
                <p className="text-xs">{new Date(household.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <div className="flex gap-1">
                  <Badge variant={household.is_final ? "default" : "outline"} className="text-xs">
                    {household.is_final ? "Final" : "Superseded"}
                  </Badge>
                  {household.is_late && (
                    <Badge variant="destructive" className="text-xs">
                      Late
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}