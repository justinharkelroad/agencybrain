import { useState, useEffect } from 'react';
import { Phone, Mail, MapPin, FileText, X, MessageSquare, Loader2, Voicemail, MessageCircle, DollarSign, Handshake, StickyNote } from 'lucide-react';
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
import { ActivityTimeline } from './ActivityTimeline';
import { ActivityLogForm, ActivityFormData } from './ActivityLogForm';
import { CustomerJourney, CustomerJourneyBadge } from './CustomerJourney';
import { SystemRecords } from './SystemRecords';
import type { SourceModule, LifecycleStage } from '@/types/contact';
import { SOURCE_MODULE_CONFIGS } from '@/types/contact';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as winbackApi from '@/lib/winbackApi';

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
  teamMembers = [],
  currentUserTeamMemberId,
  onActivityLogged,
}: ContactProfileModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityFormType, setActivityFormType] = useState<'call' | 'note' | 'email' | 'appointment' | undefined>();
  const [inlineNote, setInlineNote] = useState('');
  const [moduleActionLoading, setModuleActionLoading] = useState<string | null>(null);

  // Fetch contact profile - only when we have valid IDs and modal is open
  const { data: profile, isLoading, error } = useContactProfile(
    open ? contactId : null,
    agencyId
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

  // Determine which stage to display (prefer passed stage over computed)
  const displayStage = passedStage || profile?.current_stage;

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
      await winbackApi.logActivity(
        winbackHousehold.id,
        agencyId,
        activityType,
        '',
        currentUserTeamMemberId || null,
        teamMembers
      );

      toast.success('Activity logged');
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
  loadingAction,
}: {
  onAction: (type: string) => void;
  loadingAction: string | null;
}) {
  const actions = [
    { type: 'called', label: 'Call', icon: Phone, color: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { type: 'left_vm', label: 'Voicemail', icon: Voicemail, color: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/30' },
    { type: 'texted', label: 'Text', icon: MessageSquare, color: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { type: 'emailed', label: 'Email', icon: Mail, color: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30' },
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

export default ContactProfileModal;
