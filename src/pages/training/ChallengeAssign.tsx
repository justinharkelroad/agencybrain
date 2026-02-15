import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Users,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  UserPlus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, getDay } from 'date-fns';
import { isChallengeTier } from '@/utils/tierAccess';
import { CredentialDisplay } from '@/components/challenge/CredentialDisplay';

interface ChallengePurchase {
  id: string;
  quantity: number;
  seats_used: number;
  purchased_at: string;
}

interface StaffUser {
  id: string;
  display_name: string;
  email: string | null;
  team_member_id: string | null;
  is_active: boolean;
}

interface ExistingAssignment {
  staff_user_id: string;
  status: string;
}

// Timezone options
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona Time (AZ)' },
];

function getNextMonday(): Date {
  const today = new Date();
  const dayOfWeek = getDay(today);

  // If today is Monday and before 5 PM, use today
  if (dayOfWeek === 1 && today.getHours() < 17) {
    return today;
  }

  // Otherwise find next Monday
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  return addDays(today, daysUntilMonday);
}

function generateMondayOptions(): Date[] {
  const options: Date[] = [];
  let monday = getNextMonday();

  // Generate next 8 Mondays
  for (let i = 0; i < 8; i++) {
    options.push(monday);
    monday = addDays(monday, 7);
  }

  return options;
}

interface NewTeamMember {
  name: string;
  email: string;
}

interface CreatedCredential {
  name: string;
  username: string;
  password: string;
}

export default function ChallengeAssign() {
  const navigate = useNavigate();
  const { user, membershipTier } = useAuth();
  const isChallengeTierUser = isChallengeTier(membershipTier);

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [purchases, setPurchases] = useState<ChallengePurchase[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [existingAssignments, setExistingAssignments] = useState<ExistingAssignment[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('America/New_York');

  // New team member form state (for challenge tier users)
  const [newMembers, setNewMembers] = useState<NewTeamMember[]>([{ name: '', email: '' }]);
  const [selfParticipating, setSelfParticipating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredential[]>([]);

  const mondayOptions = generateMondayOptions();

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user!.id)
        .single();

      if (!profile?.agency_id) {
        toast.error('Agency not found');
        return;
      }

      const agencyId = profile.agency_id;

      // Fetch purchases with available seats
      const { data: purchasesData } = await supabase
        .from('challenge_purchases')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('status', 'completed')
        .order('purchased_at', { ascending: false });

      const availablePurchases = (purchasesData || []).filter(
        p => p.quantity - p.seats_used > 0
      );
      setPurchases(availablePurchases);

      if (availablePurchases.length > 0) {
        setSelectedPurchaseId(availablePurchases[0].id);
      }

      // Fetch staff users
      const { data: staffData } = await supabase
        .from('staff_users')
        .select('id, display_name, email, team_member_id, is_active')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('display_name');

      setStaffUsers(staffData || []);

      // Fetch existing assignments
      const { data: assignmentsData } = await supabase
        .from('challenge_assignments')
        .select('staff_user_id, status')
        .eq('agency_id', agencyId)
        .in('status', ['active', 'pending']);

      setExistingAssignments(assignmentsData || []);

      // Set default start date to next Monday
      setStartDate(format(getNextMonday(), 'yyyy-MM-dd'));
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffToggle = (staffId: string) => {
    const newSelected = new Set(selectedStaff);
    if (newSelected.has(staffId)) {
      newSelected.delete(staffId);
    } else {
      newSelected.add(staffId);
    }
    setSelectedStaff(newSelected);
  };

  const isStaffAlreadyAssigned = (staffId: string): boolean => {
    return existingAssignments.some(a => a.staff_user_id === staffId);
  };

  const getAvailableSeats = (): number => {
    const purchase = purchases.find(p => p.id === selectedPurchaseId);
    return purchase ? purchase.quantity - purchase.seats_used : 0;
  };

  const handleAssign = async () => {
    if (!selectedPurchaseId || selectedStaff.size === 0 || !startDate) {
      toast.error('Please select staff members and a start date');
      return;
    }

    const availableSeats = getAvailableSeats();
    if (selectedStaff.size > availableSeats) {
      toast.error(`Only ${availableSeats} seat(s) available`);
      return;
    }

    setAssigning(true);
    try {
      const { data, error } = await supabase.functions.invoke('challenge-assign-staff', {
        body: {
          purchase_id: selectedPurchaseId,
          staff_user_ids: Array.from(selectedStaff),
          start_date: startDate,
          timezone,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`Successfully assigned ${selectedStaff.size} staff member(s) to The Challenge`);
      navigate('/training/challenge');
    } catch (err) {
      console.error('Assignment error:', err);
      toast.error('Failed to assign staff members');
    } finally {
      setAssigning(false);
    }
  };

  // Handlers for new team member form
  const addMemberRow = () => {
    setNewMembers(prev => [...prev, { name: '', email: '' }]);
  };

  const removeMemberRow = (index: number) => {
    setNewMembers(prev => prev.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof NewTeamMember, value: string) => {
    setNewMembers(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const handleCreateTeam = async () => {
    const validMembers = newMembers.filter(m => m.name.trim());
    if (validMembers.length === 0 && !selfParticipating) {
      toast.error('Please add at least one team member');
      return;
    }

    if (!selectedPurchaseId || !startDate) {
      toast.error('Please select a purchase and start date');
      return;
    }

    setAssigning(true);
    try {
      const { data, error } = await supabase.functions.invoke('challenge-setup-team', {
        body: {
          purchase_id: selectedPurchaseId,
          team_members: validMembers.map(m => ({ name: m.name.trim(), email: m.email.trim() || undefined })),
          self_participating: selfParticipating,
          start_date: startDate,
          timezone,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.credentials) {
        setCreatedCredentials(data.credentials);
        toast.success(`Successfully created ${data.credentials.length} team member(s)`);
      }
    } catch (err) {
      console.error('Team creation error:', err);
      toast.error('Failed to create team members');
    } finally {
      setAssigning(false);
    }
  };

  const availableStaff = staffUsers.filter(s => !isStaffAlreadyAssigned(s.id));
  const alreadyAssignedStaff = staffUsers.filter(s => isStaffAlreadyAssigned(s.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <Link
          to="/training/challenge"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Challenge
        </Link>

        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold">No Available Seats</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Purchase seats first before assigning staff members.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/training/challenge">Purchase Seats</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Back Link */}
      <Link
        to="/training/challenge"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Challenge
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Assign Staff to The Challenge</h1>
        <p className="text-muted-foreground mt-1">
          {isChallengeTierUser && availableStaff.length === 0
            ? 'Add your team members to get started'
            : 'Select staff members and set their start date'
          }
        </p>
      </div>

      {/* Show credentials after team creation */}
      {createdCredentials.length > 0 && (
        <div className="space-y-4">
          <CredentialDisplay credentials={createdCredentials} />
          <div className="flex gap-3">
            <Button asChild>
              <Link to="/training/challenge/progress">
                View Team Progress
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            <Button variant="outline" onClick={() => {
              setCreatedCredentials([]);
              fetchData(); // Refresh to show updated state
            }}>
              Add More Members
            </Button>
          </div>
        </div>
      )}

      {/* New Team Member Form (Challenge Tier - no existing staff users) */}
      {isChallengeTierUser && availableStaff.length === 0 && createdCredentials.length === 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Add Team Members
                </CardTitle>
                <CardDescription>
                  Enter names for your team. Credentials will be shown on screen after creation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Self-participating toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label className="font-medium">Include yourself</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Join the challenge alongside your team
                    </p>
                  </div>
                  <Switch
                    checked={selfParticipating}
                    onCheckedChange={setSelfParticipating}
                  />
                </div>

                {/* Team member rows */}
                {newMembers.map((member, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Name *</Label>
                        <Input
                          placeholder="Team member name"
                          value={member.name}
                          onChange={e => updateMember(index, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Email (optional)</Label>
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          value={member.email}
                          onChange={e => updateMember(index, 'email', e.target.value)}
                        />
                      </div>
                    </div>
                    {newMembers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-5 h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMemberRow(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={addMemberRow}
                  disabled={newMembers.length + (selfParticipating ? 1 : 0) >= getAvailableSeats()}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add Another Member
                </Button>

                {newMembers.length + (selfParticipating ? 1 : 0) > getAvailableSeats() && (
                  <p className="text-sm text-destructive">
                    You have {getAvailableSeats()} available seats. Remove some members or purchase more seats.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Settings column */}
          <div className="space-y-6">
            {/* Purchase Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Purchase to Use</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={selectedPurchaseId} onValueChange={setSelectedPurchaseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select purchase" />
                  </SelectTrigger>
                  <SelectContent>
                    {purchases.map((purchase) => {
                      const available = purchase.quantity - purchase.seats_used;
                      return (
                        <SelectItem key={purchase.id} value={purchase.id}>
                          {available} seat{available !== 1 ? 's' : ''} available
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Start Date */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Start Date</CardTitle>
                <CardDescription>Challenge starts on a Monday</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={startDate} onValueChange={setStartDate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select start date" />
                  </SelectTrigger>
                  <SelectContent>
                    {mondayOptions.map((monday) => (
                      <SelectItem key={monday.toISOString()} value={format(monday, 'yyyy-MM-dd')}>
                        {format(monday, 'MMMM d, yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Timezone */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Timezone</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Create Team Button */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team members</span>
                    <span className="font-medium">
                      {newMembers.filter(m => m.name.trim()).length + (selfParticipating ? 1 : 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available seats</span>
                    <span className="font-medium">{getAvailableSeats()}</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleCreateTeam}
                  disabled={
                    assigning ||
                    (newMembers.filter(m => m.name.trim()).length === 0 && !selfParticipating) ||
                    newMembers.filter(m => m.name.trim()).length + (selfParticipating ? 1 : 0) > getAvailableSeats() ||
                    !startDate
                  }
                >
                  {assigning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Team...
                    </>
                  ) : (
                    <>
                      Create Team & Get Credentials
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Original staff selection grid (for non-challenge tier or when staff exist) */}
      {createdCredentials.length === 0 && !(isChallengeTierUser && availableStaff.length === 0) && (
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Staff Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Available Staff */}
          <Card>
            <CardHeader>
              <CardTitle>Select Staff Members</CardTitle>
              <CardDescription>
                {availableStaff.length} staff member{availableStaff.length !== 1 ? 's' : ''} available
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {availableStaff.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No available staff members. All staff are already enrolled.
                </p>
              ) : (
                availableStaff.map((staff) => (
                  <label
                    key={staff.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedStaff.has(staff.id)
                        ? 'bg-primary/5 border-primary/30'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      checked={selectedStaff.has(staff.id)}
                      onCheckedChange={() => handleStaffToggle(staff.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{staff.display_name}</p>
                      {staff.email && (
                        <p className="text-sm text-muted-foreground">{staff.email}</p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </CardContent>
          </Card>

          {/* Already Assigned */}
          {alreadyAssignedStaff.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Already Enrolled</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alreadyAssignedStaff.map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium">{staff.display_name}</p>
                      {staff.email && (
                        <p className="text-sm text-muted-foreground">{staff.email}</p>
                      )}
                    </div>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Assignment Settings */}
        <div className="space-y-6">
          {/* Purchase Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Purchase to Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={selectedPurchaseId}
                onValueChange={setSelectedPurchaseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select purchase" />
                </SelectTrigger>
                <SelectContent>
                  {purchases.map((purchase) => {
                    const available = purchase.quantity - purchase.seats_used;
                    return (
                      <SelectItem key={purchase.id} value={purchase.id}>
                        {available} seat{available !== 1 ? 's' : ''} available
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getAvailableSeats()} seat{getAvailableSeats() !== 1 ? 's' : ''} remaining
              </p>
            </CardContent>
          </Card>

          {/* Start Date */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Start Date</CardTitle>
              <CardDescription>Challenge starts on a Monday</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={startDate} onValueChange={setStartDate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select start date" />
                </SelectTrigger>
                <SelectContent>
                  {mondayOptions.map((monday) => (
                    <SelectItem
                      key={monday.toISOString()}
                      value={format(monday, 'yyyy-MM-dd')}
                    >
                      {format(monday, 'MMMM d, yyyy')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Timezone */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Timezone</CardTitle>
              <CardDescription>For email delivery timing</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Summary & Assign Button */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selected</span>
                  <span className="font-medium">
                    {selectedStaff.size} staff member{selectedStaff.size !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available seats</span>
                  <span className="font-medium">{getAvailableSeats()}</span>
                </div>
              </div>

              {selectedStaff.size > getAvailableSeats() && (
                <p className="text-sm text-destructive">
                  Not enough seats available
                </p>
              )}

              <Button
                className="w-full"
                onClick={handleAssign}
                disabled={
                  assigning ||
                  selectedStaff.size === 0 ||
                  selectedStaff.size > getAvailableSeats() ||
                  !startDate
                }
              >
                {assigning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    Assign {selectedStaff.size} Staff
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}
