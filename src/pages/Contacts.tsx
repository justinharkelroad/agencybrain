import { useState, useEffect, useMemo } from 'react';
import { Search, Users, Filter, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { clearStaffTokenIfNotStaffRoute } from '@/lib/cancel-audit-api';
import { useAuth } from '@/lib/auth';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { useContacts } from '@/hooks/useContacts';
import { ContactProfileModal, CustomerJourneyBadge } from '@/components/contacts';
import type { ContactWithStatus, LifecycleStage, ContactFilters } from '@/types/contact';
import { LIFECYCLE_STAGE_CONFIGS } from '@/types/contact';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

interface PageContext {
  agencyId: string;
  userId: string | null;
  staffMemberId: string | null;
  displayName: string;
}

export default function Contacts() {
  const { user } = useAuth();
  const { user: staffUser, loading: staffLoading } = useStaffAuth();

  // Page state
  const [context, setContext] = useState<PageContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<LifecycleStage | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'last_activity' | 'created_at'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Profile modal state
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContactStage, setSelectedContactStage] = useState<LifecycleStage | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Build filters
  const filters: ContactFilters = useMemo(
    () => ({
      search: searchQuery || undefined,
      stage: stageFilter !== 'all' ? [stageFilter] : undefined,
      sortBy,
      sortDirection,
    }),
    [searchQuery, stageFilter, sortBy, sortDirection]
  );

  // Fetch contacts with infinite scroll
  const {
    data: contactsData,
    isLoading: contactsLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useContacts(context?.agencyId || null, filters);

  // Flatten paginated data
  const contacts = useMemo(() => {
    if (!contactsData?.pages) return [];
    return contactsData.pages.flatMap((page) => page.contacts);
  }, [contactsData]);

  const totalCount = contactsData?.pages?.[0]?.total ?? 0;

  // Clear any stale staff tokens when on non-staff route
  useEffect(() => {
    clearStaffTokenIfNotStaffRoute();
  }, []);

  // Load context (agency, user info)
  useEffect(() => {
    async function load() {
      // Check for staff user first
      if (staffUser?.agency_id) {
        setContext({
          agencyId: staffUser.agency_id,
          userId: staffUser.id,
          staffMemberId: staffUser.team_member_id,
          displayName: staffUser.display_name || staffUser.username || 'Staff User',
        });
        setLoading(false);
        return;
      }

      // Fall back to regular auth user
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data: p } = await supabase
          .from('profiles')
          .select('agency_id, full_name')
          .eq('id', user.id)
          .single();

        if (p?.agency_id) {
          // Try to get display name from team_members if profile full_name is missing
          let displayName = p.full_name;
          if (!displayName && user.email) {
            const { data: teamMember } = await supabase
              .from('team_members')
              .select('name')
              .eq('agency_id', p.agency_id)
              .eq('email', user.email)
              .single();
            if (teamMember?.name) {
              displayName = teamMember.name;
            }
          }

          setContext({
            agencyId: p.agency_id,
            userId: user.id,
            staffMemberId: null,
            displayName: displayName || user.email || 'Unknown',
          });
        }
      } catch (err) {
        console.error('Error loading contacts context:', err);
      } finally {
        setLoading(false);
      }
    }

    if (!staffLoading) {
      load();
    }
  }, [user, staffUser, staffLoading]);

  // Handle opening profile modal
  const openProfile = (contactId: string, stage: LifecycleStage) => {
    setSelectedContactId(contactId);
    setSelectedContactStage(stage);
    setProfileModalOpen(true);
  };


  // Format phone for display
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Loading state
  if (loading || staffLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  // No context (not logged in or no agency)
  if (!context) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Unable to load contacts</h2>
          <p className="text-muted-foreground">
            Please ensure you are logged in and associated with an agency.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            View and manage all contacts across your agency
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Stage filter */}
          <Select
            value={stageFilter}
            onValueChange={(value) => setStageFilter(value as LifecycleStage | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {Object.entries(LIFECYCLE_STAGE_CONFIGS).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.icon} {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as 'name' | 'last_activity' | 'created_at')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="last_activity">Last Activity</SelectItem>
              <SelectItem value="created_at">Date Added</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort direction toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
          >
            {sortDirection === 'asc' ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </Card>

      {/* Contacts table */}
      <Card>
        {contactsLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : contacts && contacts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openProfile(contact.id, contact.current_stage)}
                >
                  <TableCell className="font-medium">
                    {contact.first_name} {contact.last_name}
                  </TableCell>
                  <TableCell>
                    {contact.phones[0] ? (
                      <span className="text-muted-foreground">
                        {formatPhone(contact.phones[0])}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.emails[0] ? (
                      <span className="text-muted-foreground truncate max-w-[200px] block">
                        {contact.emails[0]}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <CustomerJourneyBadge currentStage={contact.current_stage} />
                  </TableCell>
                  <TableCell>
                    {contact.assigned_team_member_name ? (
                      <span className="text-muted-foreground text-sm">
                        {contact.assigned_team_member_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.last_activity_at ? (
                      <span className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(contact.last_activity_at), {
                          addSuffix: true,
                        })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-sm">No activity</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No contacts found</h3>
            <p className="text-muted-foreground">
              {searchQuery || stageFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Contacts will appear here as they are added through LQS, Renewals, and other modules'}
            </p>
          </div>
        )}
      </Card>

      {/* Results count and Load More */}
      {contacts && contacts.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {contacts.length} of {totalCount.toLocaleString()} contact{totalCount === 1 ? '' : 's'}
          </p>
          {hasNextPage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load More'}
            </Button>
          )}
        </div>
      )}

      {/* Profile Modal */}
      {context && (
        <ContactProfileModal
          contactId={selectedContactId}
          open={profileModalOpen}
          onClose={() => {
            setProfileModalOpen(false);
            setSelectedContactId(null);
            setSelectedContactStage(null);
          }}
          agencyId={context.agencyId}
          defaultSourceModule="manual"
          currentStage={selectedContactStage || undefined}
          userId={context.userId ?? undefined}
          staffMemberId={context.staffMemberId ?? undefined}
          displayName={context.displayName}
        />
      )}
    </div>
  );
}
