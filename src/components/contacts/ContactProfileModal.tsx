import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Phone, Mail, MapPin, FileText, X, MessageSquare, Loader2, Voicemail, MessageCircle, DollarSign, Handshake, StickyNote, Calendar, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useContactProfile, useContactJourney } from '@/hooks/useContactProfile';
import { useLogContactActivity } from '@/hooks/useLogContactActivity';
import { useLogActivity as useLogCancelAuditActivity } from '@/hooks/useCancelAuditActivities';
import { useCreateRenewalActivity } from '@/hooks/useRenewalActivities';
import { ActivityTimeline } from './ActivityTimeline';
import { ActivityLogForm, ActivityFormData } from './ActivityLogForm';
import { CustomerJourney, CustomerJourneyBadge } from './CustomerJourney';
import { SystemRecords } from './SystemRecords';
import type { SourceModule, LifecycleStage } from '@/types/contact';
import { SOURCE_MODULE_CONFIGS } from '@/types/contact';
import type { RenewalRecord, ActivityType as RenewalActivityType, WorkflowStatus } from '@/types/renewal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as winbackApi from '@/lib/winbackApi';
import { supabase } from '@/integrations/supabase/client';
import { generateHouseholdKey } from '@/lib/lqs-quote-parser';

interface ContactProfileModalProps {
  contactId: string | null;
  open: boolean;
  onClose: () => void;
  // Direct props (used by pages)
  agencyId?: string | null;
  defaultSourceModule?: SourceModule;
  sourceRecordId?: string;
  userId?: string;
  staffMemberId?: string;
  displayName?: string;
  // Optional: pass stage from parent to avoid re-computing
  currentStage?: LifecycleStage;
  // For module-specific quick actions
  cancelAuditRecord?: {
    id: string;
    household_key: string;
  };
  winbackHousehold?: {
    id: string;
  };
  renewalRecord?: {
    id: string;
  };
  teamMembers?: Array<{ id: string; name: string }>;
  currentUserTeamMemberId?: string | null;
  onActivityLogged?: () => void;
}

export function ContactProfileModal({
  contactId,
  open,
  onClose,
  agencyId = null,
  defaultSourceModule = 'manual',
  sourceRecordId,
  userId,
  staffMemberId,
  displayName,
  currentStage: passedStage,
  cancelAuditRecord,
  winbackHousehold,
  renewalRecord,
  teamMembers = [],
  currentUserTeamMemberId,
  onActivityLogged,
}: ContactProfileModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityFormType, setActivityFormType] = useState<'call' | 'note' | 'email' | 'appointment' | undefined>();
  const [inlineNote, setInlineNote] = useState('');
  const [moduleActionLoading, setModuleActionLoading] = useState<string | null>(null);
  // Track if a mutation has occurred - used to prefer fresh profile stage over stale passedStage
  const [hasMutated, setHasMutated] = useState(false);

  // Query client for cache invalidation
  const queryClient = useQueryClient();

  // Fetch contact profile - only when we have valid IDs and modal is open
  const { data: profile, isLoading, error } = useContactProfile(
    open ? contactId : null,
    agencyId,
    {
      cancelAuditHouseholdKey: cancelAuditRecord?.household_key,
      winbackHouseholdId: winbackHousehold?.id,
      renewalRecordId: renewalRecord?.id,
    }
  );

  // Fetch journey events
  const { data: journeyEvents } = useContactJourney(
    open ? contactId : null,
    agencyId
  );

  // Activity logging mutation
  const logActivity = useLogContactActivity();

  // Module-specific activity logging
  const logCancelAuditActivity = useLogCancelAuditActivity();
  const createRenewalActivity = useCreateRenewalActivity();

  // Determine which stage to display
  // After a mutation, prefer the fresh profile stage over the stale passedStage prop
  const displayStage = hasMutated
    ? (profile?.current_stage || passedStage)
    : (passedStage || profile?.current_stage);

  // Reset hasMutated flag when modal closes
  useEffect(() => {
    if (!open) {
      setHasMutated(false);
    }
  }, [open]);

  // Handle sidebar navigation event to close modal
  useEffect(() => {
    const handleNavigation = () => onClose();
    window.addEventListener('sidebar-navigation', handleNavigation);
    return () => window.removeEventListener('sidebar-navigation', handleNavigation);
  }, [onClose]);

  // Handle activity logging
  const handleLogActivity = async (data: ActivityFormData) => {
    if (!contactId || !agencyId) return;

    await logActivity.mutateAsync({
      contactId,
      agencyId,
      activityType: data.activityType,
      sourceModule: data.sourceModule,
      sourceRecordId,
      callDirection: data.callDirection,
      outcome: data.outcome,
      subject: data.subject,
      notes: data.notes,
      scheduledDate: data.scheduledDate,
      createdByUserId: userId,
      createdByStaffId: staffMemberId,
      createdByDisplayName: displayName,
    });

    setShowActivityForm(false);
    setActivityFormType(undefined);
  };

  // Quick action handlers
  const openActivityForm = (type?: 'call' | 'note' | 'email' | 'appointment') => {
    setActivityFormType(type);
    setShowActivityForm(true);
  };

  // Quick log handlers for one-click activities
  const quickLogActivity = async (type: 'email' | 'text') => {
    if (!contactId || !agencyId) return;

    const subject = type === 'email' ? 'Sent email' : 'Sent text message';

    await logActivity.mutateAsync({
      contactId,
      agencyId,
      activityType: type,
      sourceModule: defaultSourceModule,
      sourceRecordId,
      subject,
      createdByUserId: userId,
      createdByStaffId: staffMemberId,
      createdByDisplayName: displayName,
    });
  };

  // Inline note submission
  const handleSaveNote = async () => {
    if (!contactId || !agencyId || !inlineNote.trim()) return;

    await logActivity.mutateAsync({
      contactId,
      agencyId,
      activityType: 'note',
      sourceModule: defaultSourceModule,
      sourceRecordId,
      notes: inlineNote.trim(),
      createdByUserId: userId,
      createdByStaffId: staffMemberId,
      createdByDisplayName: displayName,
    });

    setInlineNote('');
  };

  // Module-specific activity handlers for Cancel Audit
  const handleCancelAuditActivity = async (activityType: string) => {
    if (!agencyId || !cancelAuditRecord || !displayName) return;

    setModuleActionLoading(activityType);
    try {
      await logCancelAuditActivity.mutateAsync({
        agencyId,
        recordId: cancelAuditRecord.id,
        householdKey: cancelAuditRecord.household_key,
        activityType: activityType as any,
        userId,
        staffMemberId,
        userDisplayName: displayName,
      });

      if (activityType === 'payment_made') {
        toast.success('🎉 Payment recorded!', { description: 'Great job saving this policy!' });
      } else if (activityType === 'payment_promised') {
        toast.success('Payment promised logged', { description: 'Follow up if not received' });
      } else {
        toast.success('Activity logged');
      }

      // Invalidate queries to refresh data - including contacts for real-time stage updates
      queryClient.invalidateQueries({ queryKey: ['contact-profile', contactId] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-activity-summary'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setHasMutated(true); // Enable real-time stage update display
      onActivityLogged?.();
    } catch (error: any) {
      toast.error('Failed to log activity', { description: error.message });
    } finally {
      setModuleActionLoading(null);
    }
  };

  // Module-specific activity handlers for Winback
  const handleWinbackActivity = async (activityType: string) => {
    if (!agencyId || !winbackHousehold) return;

    setModuleActionLoading(activityType);
    try {
      // Log the activity
      await winbackApi.logActivity(
        winbackHousehold.id,
        agencyId,
        activityType,
        '',
        currentUserTeamMemberId || null,
        teamMembers
      );

      // Also update status from untouched to in_progress if needed
      // This marks the household as "touched"
      await winbackApi.updateHouseholdStatus(
        winbackHousehold.id,
        agencyId,
        'in_progress',
        'untouched', // old status - only changes if currently untouched
        currentUserTeamMemberId || null,
        teamMembers,
        null // assignedTo
      ).catch(() => {
        // Ignore errors - status may already be in_progress or won_back
      });

      toast.success('Activity logged');

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['contact-profile', contactId] });
      queryClient.invalidateQueries({ queryKey: ['winback-activity-summary'] });
      queryClient.invalidateQueries({ queryKey: ['winback-households'] });
      onActivityLogged?.();
    } catch (error: any) {
      toast.error('Failed to log activity', { description: error.message });
    } finally {
      setModuleActionLoading(null);
    }
  };

  // Winback outcome handler - Won Back or Quoted
  const handleWinbackOutcome = async (outcome: 'won_back' | 'quoted') => {
    if (!agencyId || !winbackHousehold || !profile) return;

    setModuleActionLoading(outcome);
    try {
      if (outcome === 'quoted') {
        // Step 1: Find or create "Winback" lead source
        let winbackLeadSourceId: string | null = null;
        let createdNewLeadSource = false;

        // Look for existing "Winback" lead source (case-insensitive)
        const { data: existingSource } = await supabase
          .from('lead_sources')
          .select('id')
          .eq('agency_id', agencyId)
          .ilike('name', 'winback')
          .limit(1)
          .single();

        if (existingSource) {
          winbackLeadSourceId = existingSource.id;
        } else {
          // Create "Winback" lead source for this agency
          const { data: newSource, error: createError } = await supabase
            .from('lead_sources')
            .insert({
              agency_id: agencyId,
              name: 'Winback',
              is_active: true,
              is_self_generated: false, // Not self-generated - originally paid marketing
              cost_type: 'per_lead',
              cost_per_lead_cents: 0,
            })
            .select('id')
            .single();

          if (!createError && newSource) {
            winbackLeadSourceId = newSource.id;
            createdNewLeadSource = true;
          }
        }

        // Step 2: Create/update LQS record with status 'quoted' and Winback lead source
        const householdKey = generateHouseholdKey(
          profile.first_name,
          profile.last_name,
          profile.zip_code
        );

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Upsert LQS record - if exists, update status to quoted; if not, create it
        // Auto-assign to the person who clicked Quoted
        const { error: lqsError } = await supabase
          .from('lqs_households')
          .upsert({
            agency_id: agencyId,
            household_key: householdKey,
            first_name: profile.first_name.toUpperCase(),
            last_name: profile.last_name.toUpperCase(),
            zip_code: profile.zip_code || '',
            contact_id: contactId,
            status: 'quoted',
            lead_source_id: winbackLeadSourceId,
            assigned_to: currentUserTeamMemberId || null, // Auto-assign to the person who clicked Quoted
            first_quote_date: today, // Reset quote date for new quote cycle
            lead_received_date: today,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'agency_id,household_key',
          });

        if (lqsError) throw lqsError;

        // Step 3: Mark winback as moved_to_quoted (they agreed to get a quote)
        await winbackApi.updateHouseholdStatus(
          winbackHousehold.id,
          agencyId,
          'moved_to_quoted',
          'in_progress',
          currentUserTeamMemberId || null,
          teamMembers,
          null
        ).catch(() => {
          // Ignore status update errors - LQS record is the important part
        });

        // Step 4: Log the quoted activity so it appears in Daily Activity Summary
        await winbackApi.logActivity(
          winbackHousehold.id,
          agencyId,
          'quoted',
          'Moved to Quoted Household',
          currentUserTeamMemberId || null,
          teamMembers
        );

        // Show success with note if we created a new lead source
        if (createdNewLeadSource) {
          toast.success('Moved to Quoted!', {
            description: 'Contact is now a Quoted Household. "Winback" lead source was added to your settings.'
          });
        } else {
          toast.success('Moved to Quoted!', { description: 'Contact is now a Quoted Household' });
        }
      } else {
        // Update to won_back status - this transitions contact to Customer
        await winbackApi.updateHouseholdStatus(
          winbackHousehold.id,
          agencyId,
          'won_back',
          'in_progress', // Can also be from untouched
          currentUserTeamMemberId || null,
          teamMembers,
          null
        );

        // Log the won_back activity so it appears in Daily Activity Summary
        await winbackApi.logActivity(
          winbackHousehold.id,
          agencyId,
          'won_back',
          'Customer won back!',
          currentUserTeamMemberId || null,
          teamMembers
        );

        toast.success('Customer won back!', { description: 'Contact is now a Customer' });
      }

      // Invalidate queries to refresh data - including contacts for real-time stage updates
      queryClient.invalidateQueries({ queryKey: ['contact-profile', contactId] });
      queryClient.invalidateQueries({ queryKey: ['winback-activity-summary'] });
      queryClient.invalidateQueries({ queryKey: ['winback-households'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setHasMutated(true); // Enable real-time stage update display
      onActivityLogged?.();
    } catch (error: any) {
      toast.error('Failed to update status', { description: error.message });
    } finally {
      setModuleActionLoading(null);
    }
  };

  // Module-specific activity handlers for Renewals
  const handleRenewalActivity = async (
    activityType: RenewalActivityType,
    activityStatus?: string,
    updateRecordStatus?: WorkflowStatus
  ) => {
    if (!agencyId || !renewalRecord || !displayName) return;

    setModuleActionLoading(activityType + (activityStatus || ''));
    try {
      await createRenewalActivity.mutateAsync({
        renewalRecordId: renewalRecord.id,
        agencyId,
        activityType,
        activityStatus,
        displayName,
        userId: userId || null,
        updateRecordStatus,
      });

      // If marked as successful, also update renewal_status and close out any winback
      if (activityStatus === 'successful') {
        // Update renewal_status to 'Renewal Taken' for display consistency
        await supabase
          .from('renewal_records')
          .update({ renewal_status: 'Renewal Taken' })
          .eq('id', renewalRecord.id);

        // Close out any associated winback record - check by winback_household_id or contact_id
        if (renewalRecord.winback_household_id) {
          // Direct link exists - update that winback
          await supabase
            .from('winback_households')
            .update({ status: 'won_back', updated_at: new Date().toISOString() })
            .eq('id', renewalRecord.winback_household_id)
            .eq('agency_id', agencyId);
        } else if (contactId) {
          // No direct link - find winback by contact_id and close it
          await supabase
            .from('winback_households')
            .update({ status: 'won_back', updated_at: new Date().toISOString() })
            .eq('contact_id', contactId)
            .eq('agency_id', agencyId)
            .in('status', ['untouched', 'in_progress']); // Only update active winbacks
        }

        // Invalidate winback queries too since we may have updated a winback record
        queryClient.invalidateQueries({ queryKey: ['winback-households'] });
        queryClient.invalidateQueries({ queryKey: ['winback-activity-summary'] });

        toast.success('Renewal marked as successful!', { description: 'Great work!' });
      } else if (activityStatus === 'push_to_winback') {
        toast.success('Pushed to Winback', { description: 'Record will appear in Winback module' });
      } else {
        toast.success('Activity logged');
      }

      // Invalidate queries to refresh data - including contacts for real-time stage updates
      queryClient.invalidateQueries({ queryKey: ['contact-profile', contactId] });
      queryClient.invalidateQueries({ queryKey: ['renewal-activity-summary'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setHasMutated(true); // Enable real-time stage update display
      onActivityLogged?.();
    } catch (error: any) {
      toast.error('Failed to log activity', { description: error.message });
    } finally {
      setModuleActionLoading(null);
    }
  };

  // Format phone for display
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Format address
  const formatAddress = () => {
    if (!profile) return null;
    const parts = [
      profile.street_address,
      profile.city,
      profile.state,
      profile.zip_code,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const sourceConfig = defaultSourceModule ? SOURCE_MODULE_CONFIGS[defaultSourceModule] : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {isLoading ? (
            <LoadingSkeleton />
          ) : error ? (
            <ErrorState error={error} onClose={onClose} />
          ) : profile ? (
            <>
              <SheetHeader className="space-y-4 pb-4">
                {/* Name and stage badge */}
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="text-xl">
                      {profile.first_name} {profile.last_name}
                    </SheetTitle>
                    <div className="mt-1">
                      <CustomerJourneyBadge currentStage={displayStage || 'open_lead'} />
                    </div>
                  </div>
                  {sourceConfig && (
                    <Badge
                      variant="outline"
                      className={cn('text-xs', sourceConfig.color, sourceConfig.bgColor)}
                    >
                      Opened from: {sourceConfig.icon} {sourceConfig.label}
                    </Badge>
                  )}
                </div>

                {/* Contact info */}
                <div className="space-y-2 text-sm">
                  {profile.phones.length > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <a
                        href={`tel:${profile.phones[0]}`}
                        className="hover:text-primary hover:underline"
                      >
                        {formatPhone(profile.phones[0])}
                      </a>
                      {profile.phones.length > 1 && (
                        <span className="text-xs">+{profile.phones.length - 1} more</span>
                      )}
                    </div>
                  )}
                  {profile.emails.length > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <a
                        href={`mailto:${profile.emails[0]}`}
                        className="hover:text-primary hover:underline"
                      >
                        {profile.emails[0]}
                      </a>
                      {profile.emails.length > 1 && (
                        <span className="text-xs">+{profile.emails.length - 1} more</span>
                      )}
                    </div>
                  )}
                  {formatAddress() && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{formatAddress()}</span>
                    </div>
                  )}
                </div>

                {/* Quick actions - module-specific or generic */}
                {defaultSourceModule === 'cancel_audit' && cancelAuditRecord ? (
                  <CancelAuditQuickActions
                    onAction={handleCancelAuditActivity}
                    loadingAction={moduleActionLoading}
                  />
                ) : defaultSourceModule === 'winback' && winbackHousehold ? (
                  <WinbackQuickActions
                    onAction={handleWinbackActivity}
                    onOutcome={handleWinbackOutcome}
                    loadingAction={moduleActionLoading}
                  />
                ) : defaultSourceModule === 'renewal' && renewalRecord ? (
                  <RenewalQuickActions
                    onAction={handleRenewalActivity}
                    loadingAction={moduleActionLoading}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openActivityForm('call')}
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      Log Call
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => quickLogActivity('email')}
                      disabled={logActivity.isPending}
                    >
                      {logActivity.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-1" />
                      )}
                      Log Email
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => quickLogActivity('text')}
                      disabled={logActivity.isPending}
                    >
                      {logActivity.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4 mr-1" />
                      )}
                      Log Text
                    </Button>
                  </div>
                )}
              </SheetHeader>

              <Separator className="my-4" />

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="records">Records</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-6">
                  {/* Customer Journey */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Customer Journey</h3>
                    <CustomerJourney
                      events={journeyEvents || []}
                      currentStage={displayStage || 'open_lead'}
                    />
                  </div>

                  {/* Inline Add Note */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Add Note</h3>
                    <div className="flex gap-2">
                      <Textarea
                        value={inlineNote}
                        onChange={(e) => setInlineNote(e.target.value)}
                        placeholder="Type a note..."
                        rows={2}
                        className="flex-1 resize-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handleSaveNote();
                          }
                        }}
                      />
                      <Button
                        onClick={handleSaveNote}
                        disabled={!inlineNote.trim() || logActivity.isPending}
                        className="self-end"
                      >
                        {logActivity.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Save'
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Recent Activity Preview */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium">Recent Activity</h3>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => setActiveTab('activity')}
                      >
                        View all
                      </Button>
                    </div>
                    <ActivityTimeline
                      activities={profile.activities.slice(0, 3)}
                      maxHeight="200px"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                  <ActivityTimeline
                    activities={profile.activities}
                    maxHeight="calc(100vh - 400px)"
                  />
                </TabsContent>

                <TabsContent value="records" className="mt-4">
                  <SystemRecords
                    lqsRecords={profile.lqs_records}
                    renewalRecords={profile.renewal_records}
                    cancelAuditRecords={profile.cancel_audit_records}
                    winbackRecords={profile.winback_records}
                  />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <EmptyState onClose={onClose} />
          )}
        </SheetContent>
      </Sheet>

      {/* Activity Log Form Modal */}
      <ActivityLogForm
        open={showActivityForm}
        onClose={() => {
          setShowActivityForm(false);
          setActivityFormType(undefined);
        }}
        onSubmit={handleLogActivity}
        defaultSourceModule={defaultSourceModule}
        isLoading={logActivity.isPending}
        activityType={activityFormType}
      />
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}

function ErrorState({ error, onClose }: { error: Error; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <X className="h-12 w-12 text-destructive mb-4" />
      <h3 className="font-medium text-lg mb-2">Failed to load contact</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {error.message || 'An unexpected error occurred'}
      </p>
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="font-medium text-lg mb-2">Contact not found</h3>
      <p className="text-sm text-muted-foreground mb-4">
        This contact may have been removed or you don't have access to it.
      </p>
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

// Cancel Audit Quick Actions - matches the existing QuickActions component
function CancelAuditQuickActions({
  onAction,
  loadingAction,
}: {
  onAction: (type: string) => void;
  loadingAction: string | null;
}) {
  const actions = [
    { type: 'attempted_call', label: 'Call', icon: Phone, color: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { type: 'voicemail_left', label: 'Voicemail', icon: Voicemail, color: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/30' },
    { type: 'text_sent', label: 'Text', icon: MessageSquare, color: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { type: 'email_sent', label: 'Email', icon: Mail, color: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { type: 'spoke_with_client', label: 'Spoke', icon: MessageCircle, color: 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    { type: 'payment_made', label: 'Paid', icon: DollarSign, color: 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30' },
    { type: 'payment_promised', label: 'Promised', icon: Handshake, color: 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ type, label, icon: Icon, color }) => (
        <Button
          key={type}
          variant="outline"
          size="sm"
          className={cn('border transition-colors', color, loadingAction && 'opacity-50')}
          onClick={() => onAction(type)}
          disabled={loadingAction !== null}
        >
          {loadingAction === type ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Icon className="h-3.5 w-3.5 mr-1.5" />
          )}
          {label}
        </Button>
      ))}
    </div>
  );
}

// Winback Quick Actions - matches the existing WinbackHouseholdModal actions
function WinbackQuickActions({
  onAction,
  onOutcome,
  loadingAction,
}: {
  onAction: (type: string) => void;
  onOutcome: (outcome: 'won_back' | 'quoted') => void;
  loadingAction: string | null;
}) {
  const contactActions = [
    { type: 'called', label: 'Call', icon: Phone, color: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { type: 'left_vm', label: 'Voicemail', icon: Voicemail, color: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/30' },
    { type: 'texted', label: 'Text', icon: MessageSquare, color: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { type: 'emailed', label: 'Email', icon: Mail, color: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30' },
  ];

  const outcomeActions = [
    { outcome: 'quoted' as const, label: 'Quoted', icon: FileText, color: 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { outcome: 'won_back' as const, label: 'Won Back', icon: CheckCircle2, color: 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30' },
  ];

  return (
    <div className="space-y-2">
      {/* Contact activity buttons */}
      <div className="flex flex-wrap gap-2">
        {contactActions.map(({ type, label, icon: Icon, color }) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            className={cn('border transition-colors', color, loadingAction && 'opacity-50')}
            onClick={() => onAction(type)}
            disabled={loadingAction !== null}
          >
            {loadingAction === type ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5 mr-1.5" />
            )}
            {label}
          </Button>
        ))}
      </div>
      {/* Outcome buttons - Quoted and Won Back */}
      <div className="flex flex-wrap gap-2">
        {outcomeActions.map(({ outcome, label, icon: Icon, color }) => (
          <Button
            key={outcome}
            variant="outline"
            size="sm"
            className={cn('border transition-colors', color, loadingAction && 'opacity-50')}
            onClick={() => onOutcome(outcome)}
            disabled={loadingAction !== null}
          >
            {loadingAction === outcome ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5 mr-1.5" />
            )}
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// Renewal Quick Actions - matches the existing ScheduleActivityModal actions
function RenewalQuickActions({
  onAction,
  loadingAction,
}: {
  onAction: (activityType: RenewalActivityType, activityStatus?: string, updateRecordStatus?: WorkflowStatus) => void;
  loadingAction: string | null;
}) {
  const contactActions = [
    { type: 'call' as RenewalActivityType, label: 'Call', icon: Phone, color: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { type: 'voicemail' as RenewalActivityType, label: 'Voicemail', icon: Voicemail, color: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/30' },
    { type: 'text' as RenewalActivityType, label: 'Text', icon: MessageSquare, color: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { type: 'email' as RenewalActivityType, label: 'Email', icon: Mail, color: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { type: 'appointment' as RenewalActivityType, label: 'Appt', icon: Calendar, color: 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  ];

  const outcomeActions = [
    {
      type: 'review_done' as RenewalActivityType,
      status: 'successful',
      updateStatus: 'success' as WorkflowStatus,
      label: 'Successful',
      icon: CheckCircle2,
      color: 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30'
    },
    {
      type: 'review_done' as RenewalActivityType,
      status: 'push_to_winback',
      updateStatus: 'unsuccessful' as WorkflowStatus,
      label: 'To Winback',
      icon: ArrowRightLeft,
      color: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
    },
  ];

  return (
    <div className="space-y-2">
      {/* Contact activity buttons */}
      <div className="flex flex-wrap gap-2">
        {contactActions.map(({ type, label, icon: Icon, color }) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            className={cn('border transition-colors', color, loadingAction && 'opacity-50')}
            onClick={() => onAction(type)}
            disabled={loadingAction !== null}
          >
            {loadingAction === type ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5 mr-1.5" />
            )}
            {label}
          </Button>
        ))}
      </div>
      {/* Review outcome buttons */}
      <div className="flex flex-wrap gap-2">
        {outcomeActions.map(({ type, status, updateStatus, label, icon: Icon, color }) => {
          const key = type + status;
          return (
            <Button
              key={key}
              variant="outline"
              size="sm"
              className={cn('border transition-colors', color, loadingAction && 'opacity-50')}
              onClick={() => onAction(type, status, updateStatus)}
              disabled={loadingAction !== null}
            >
              {loadingAction === key ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5 mr-1.5" />
              )}
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default ContactProfileModal;
