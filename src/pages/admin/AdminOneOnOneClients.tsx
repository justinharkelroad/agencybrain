import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Trash2,
  Sparkles,
  Users,
  Building2,
  Search,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';

interface Agency {
  id: string;
  name: string;
  created_at: string;
}

interface FeatureAccess {
  id: string;
  agency_id: string;
  feature_key: string;
  granted_by: string | null;
  granted_at: string;
  notes: string | null;
  agency?: Agency;
}

const FEATURE_INFO = {
  sales_process_builder: {
    title: 'Sales Process Builder',
    description: 'AI-powered Sales Process Builder tool',
    icon: Sparkles,
  },
};

export default function AdminOneOnOneClients() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Fetch all agencies
  const { data: agencies, isLoading: agenciesLoading } = useQuery({
    queryKey: ['admin-agencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name, created_at')
        .order('name');

      if (error) throw error;
      return data as Agency[];
    },
  });

  // Fetch feature access records
  const { data: featureAccess, isLoading: accessLoading } = useQuery({
    queryKey: ['admin-feature-access', 'sales_process_builder'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agency_feature_access')
        .select(`
          id,
          agency_id,
          feature_key,
          granted_by,
          granted_at,
          notes
        `)
        .eq('feature_key', 'sales_process_builder')
        .order('granted_at', { ascending: false });

      if (error) throw error;

      // Fetch agency names
      const agencyIds = data.map(d => d.agency_id);
      const { data: agencyData } = await supabase
        .from('agencies')
        .select('id, name, created_at')
        .in('id', agencyIds);

      const agencyMap = new Map(agencyData?.map(a => [a.id, a]) || []);

      return data.map(d => ({
        ...d,
        agency: agencyMap.get(d.agency_id),
      })) as FeatureAccess[];
    },
  });

  // Grant access mutation
  const grantAccessMutation = useMutation({
    mutationFn: async ({ agencyId, notes }: { agencyId: string; notes: string }) => {
      const { data, error } = await supabase
        .from('agency_feature_access')
        .insert({
          agency_id: agencyId,
          feature_key: 'sales_process_builder',
          granted_by: user?.id,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Access granted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-feature-access'] });
      setIsAddDialogOpen(false);
      setSelectedAgencyId('');
      setNotes('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to grant access');
    },
  });

  // Revoke access mutation
  const revokeAccessMutation = useMutation({
    mutationFn: async (accessId: string) => {
      const { error } = await supabase
        .from('agency_feature_access')
        .delete()
        .eq('id', accessId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Access revoked');
      queryClient.invalidateQueries({ queryKey: ['admin-feature-access'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revoke access');
    },
  });

  // Filter agencies that don't already have access
  const availableAgencies = agencies?.filter(
    agency => !featureAccess?.some(fa => fa.agency_id === agency.id)
  ) || [];

  // Filter by search
  const filteredAgencies = availableAgencies.filter(
    agency => agency.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAccess = featureAccess?.filter(
    fa => fa.agency?.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const isLoading = agenciesLoading || accessLoading;

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">1:1 Clients</h1>
        </div>
        <p className="text-muted-foreground">
          Manage agencies with access to premium 1:1 features like the Sales Process Builder.
        </p>
      </div>

      {/* Stats Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{featureAccess?.length || 0}</p>
              <p className="text-sm text-muted-foreground">
                Agencies with Sales Process Builder access
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sales Process Builder Access</CardTitle>
              <CardDescription>
                Grant or revoke access to the standalone Sales Process Builder tool.
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Grant Access
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Grant Sales Process Builder Access</DialogTitle>
                  <DialogDescription>
                    Select an agency to grant access to the Sales Process Builder tool.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Agency</Label>
                    <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an agency..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredAgencies.map(agency => (
                          <SelectItem key={agency.id} value={agency.id}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              {agency.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Textarea
                      placeholder="e.g., 1:1 coaching client, enrolled Jan 2026"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => grantAccessMutation.mutate({ agencyId: selectedAgencyId, notes })}
                    disabled={!selectedAgencyId || grantAccessMutation.isPending}
                  >
                    {grantAccessMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Granting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Grant Access
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agencies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredAccess.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No agencies have been granted access yet.</p>
              <p className="text-sm">Click "Grant Access" to add your first 1:1 client.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency</TableHead>
                  <TableHead>Granted</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccess.map(access => (
                  <TableRow key={access.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{access.agency?.name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(access.granted_at), 'MMM d, yyyy')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {access.notes || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => revokeAccessMutation.mutate(access.id)}
                        disabled={revokeAccessMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
