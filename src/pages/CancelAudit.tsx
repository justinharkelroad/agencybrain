import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileWarning, BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CancelAuditUploadModal } from "@/components/cancel-audit/CancelAuditUploadModal";
import { useToast } from "@/hooks/use-toast";

const CancelAuditPage = () => {
  const { user, membershipTier, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  
  // Agency context
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [staffMemberId, setStaffMemberId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('Unknown User');

  useEffect(() => {
    const checkAccess = async () => {
      if (authLoading) return;
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check membership tier - must be boardroom or one_on_one_coaching
      const validTiers = ['boardroom', 'one_on_one_coaching', 'one_on_one'];
      const tierLower = membershipTier?.toLowerCase() || '';
      const hasTierAccess = validTiers.some(t => tierLower.includes(t));

      // Get user profile and agency info
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, agency_id, full_name, email')
        .eq('id', user.id)
        .single();

      if (!hasTierAccess && profile?.role !== 'admin') {
        navigate("/dashboard");
        return;
      }

      // Set agency context
      const userAgencyId = profile?.agency_id || user.user_metadata?.staff_agency_id;
      
      if (!userAgencyId) {
        toast({
          title: "Error",
          description: "No agency associated with your account",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setAgencyId(userAgencyId);
      
      // Check if staff portal user
      const staffAgencyId = user.user_metadata?.staff_agency_id;
      if (staffAgencyId) {
        // Staff portal user - get staff member info
        const staffMemberIdFromMeta = user.user_metadata?.staff_member_id;
        if (staffMemberIdFromMeta) {
          const { data: staffMember } = await supabase
            .from('team_members')
            .select('id, name')
            .eq('id', staffMemberIdFromMeta)
            .single();
          
          if (staffMember) {
            setStaffMemberId(staffMember.id);
            setDisplayName(staffMember.name);
          }
        }
      } else {
        // Regular auth user
        setUserId(user.id);
        setDisplayName(profile?.full_name || profile?.email || user.email || 'Unknown User');
      }

      setHasAccess(true);
      setLoading(false);
    };

    checkAccess();
  }, [user, membershipTier, authLoading, navigate, toast]);

  const handleUploadComplete = () => {
    toast({
      title: "Upload Complete",
      description: "Records have been processed successfully",
    });
    // Future: refresh records list
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Cancel Audit</h1>
              <p className="text-muted-foreground mt-1">
                Track and manage cancellation and pending cancel reports
              </p>
            </div>
            <Button onClick={() => setUploadModalOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Report
            </Button>
          </div>
        </div>
      </div>

      {/* Weekly Stats Summary - Placeholder */}
      <div className="container mx-auto px-4 py-6">
        <Card className="p-6 bg-card border-border">
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Weekly summary will appear here once you upload reports</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Bar - Placeholder */}
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <Button variant="ghost" size="sm" className="rounded-md">All</Button>
            <Button variant="ghost" size="sm" className="rounded-md">Pending Cancel</Button>
            <Button variant="ghost" size="sm" className="rounded-md">Cancelled</Button>
          </div>
          <div className="flex-1" />
          <Input 
            placeholder="Search by name or policy..." 
            className="max-w-xs"
            disabled
          />
        </div>
      </div>

      {/* Empty State */}
      <div className="container mx-auto px-4 pb-12">
        <Card className="p-12 bg-card border-border border-dashed">
          <div className="text-center">
            <FileWarning className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">No records yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Upload your first Cancellation Audit or Pending Cancel report to start tracking and managing at-risk policies.
            </p>
            <Button onClick={() => setUploadModalOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Your First Report
            </Button>
          </div>
        </Card>
      </div>

      {/* Upload Modal */}
      {agencyId && (
        <CancelAuditUploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          agencyId={agencyId}
          userId={userId}
          staffMemberId={staffMemberId}
          displayName={displayName}
          onUploadComplete={handleUploadComplete}
        />
      )}
    </div>
  );
};

export default CancelAuditPage;
