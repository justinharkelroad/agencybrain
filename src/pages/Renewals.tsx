import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Upload, Search, Trash2, ChevronDown, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useRenewalRecords, useRenewalStats, useRenewalProductNames, useBulkUpdateRenewals, useBulkDeleteRenewals, type RenewalFilters } from '@/hooks/useRenewalRecords';
import { RenewalUploadModal } from '@/components/renewals/RenewalUploadModal';
import { RenewalDetailDrawer } from '@/components/renewals/RenewalDetailDrawer';
import type { RenewalRecord, RenewalUploadContext, WorkflowStatus } from '@/types/renewal';

const STATUS_COLORS: Record<WorkflowStatus, string> = { uncontacted: 'bg-slate-100 text-slate-700', pending: 'bg-amber-100 text-amber-700', success: 'bg-green-100 text-green-700', unsuccessful: 'bg-red-100 text-red-700' };

export default function Renewals() {
  const { user } = useAuth();
  const [context, setContext] = useState<RenewalUploadContext | null>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RenewalRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState<RenewalFilters>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function load() {
      if (!user?.id) { setLoading(false); return; }
      try {
        const { data: p } = await supabase.from('profiles').select('agency_id, full_name').eq('id', user.id).single();
        if (p?.agency_id) {
          setContext({ agencyId: p.agency_id, userId: user.id, staffMemberId: null, displayName: p.full_name || user.email || 'Unknown' });
          const { data: m } = await supabase.from('team_members').select('id, name').eq('agency_id', p.agency_id).eq('status', 'active').order('name');
          setTeamMembers(m || []);
        }
      } catch {} finally { setLoading(false); }
    }
    load();
  }, [user]);

  const effectiveFilters = useMemo(() => {
    const f = { ...filters };
    if (activeTab !== 'all') f.currentStatus = [activeTab as WorkflowStatus];
    if (searchQuery) f.search = searchQuery;
    return f;
  }, [filters, activeTab, searchQuery]);

  const { data: records = [], isLoading: recordsLoading } = useRenewalRecords(context?.agencyId || null, effectiveFilters);
  const { data: stats } = useRenewalStats(context?.agencyId || null);
  const { data: productNames = [] } = useRenewalProductNames(context?.agencyId || null);
  const bulkUpdate = useBulkUpdateRenewals();
  const bulkDelete = useBulkDeleteRenewals();

  const toggleSelectAll = () => { selectedIds.size === records.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(records.map(r => r.id))); };
  const toggleSelect = (id: string) => { const s = new Set(selectedIds); s.has(id) ? s.delete(id) : s.add(id); setSelectedIds(s); };
  const handleBulkDelete = () => { bulkDelete.mutate(Array.from(selectedIds), { onSuccess: () => { setSelectedIds(new Set()); setShowDeleteDialog(false); } }); };
  const handleBulkStatus = (status: WorkflowStatus) => { if (!context) return; bulkUpdate.mutate({ ids: Array.from(selectedIds), updates: { current_status: status }, displayName: context.displayName, userId: context.userId }, { onSuccess: () => setSelectedIds(new Set()) }); };

  if (loading) return <div className="container mx-auto p-6 flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
  if (!context) return <div className="container mx-auto p-6"><Card className="p-6 text-center text-muted-foreground">Unable to load context.</Card></div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><RefreshCw className="h-8 w-8" /><h1 className="text-3xl font-bold">Renewals</h1></div>
        <Button onClick={() => setShowUploadModal(true)}><Upload className="h-4 w-4 mr-2" />Upload Report</Button>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{stats?.total || 0}</Badge></TabsTrigger>
          <TabsTrigger value="uncontacted">Uncontacted <Badge variant="secondary" className="ml-2">{stats?.uncontacted || 0}</Badge></TabsTrigger>
          <TabsTrigger value="pending">Pending <Badge variant="secondary" className="ml-2">{stats?.pending || 0}</Badge></TabsTrigger>
          <TabsTrigger value="success">Success <Badge variant="secondary" className="ml-2">{stats?.success || 0}</Badge></TabsTrigger>
          <TabsTrigger value="unsuccessful">Unsuccessful <Badge variant="secondary" className="ml-2">{stats?.unsuccessful || 0}</Badge></TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div>
        <Select value={filters.bundledStatus || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, bundledStatus: v as any }))}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Bundled" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="bundled">Bundled</SelectItem><SelectItem value="monoline">Monoline</SelectItem></SelectContent></Select>
        <Select value={filters.productName?.[0] || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, productName: v === 'all' ? undefined : [v] }))}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Product" /></SelectTrigger><SelectContent><SelectItem value="all">All Products</SelectItem>{productNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select>
      </div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm">Status <ChevronDown className="h-4 w-4 ml-2" /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => handleBulkStatus('uncontacted')}>Uncontacted</DropdownMenuItem><DropdownMenuItem onClick={() => handleBulkStatus('pending')}>Pending</DropdownMenuItem><DropdownMenuItem onClick={() => handleBulkStatus('success')}>Success</DropdownMenuItem><DropdownMenuItem onClick={() => handleBulkStatus('unsuccessful')}>Unsuccessful</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
        </div>
      )}
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead className="w-[40px]"><Checkbox checked={selectedIds.size === records.length && records.length > 0} onCheckedChange={toggleSelectAll} /></TableHead><TableHead>Effective</TableHead><TableHead>Customer</TableHead><TableHead>Policy</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Premium</TableHead><TableHead className="text-right">Change</TableHead><TableHead>Bundled</TableHead><TableHead>Status</TableHead><TableHead>Assigned</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
          <TableBody>
            {recordsLoading ? <TableRow><TableCell colSpan={11} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            : records.length === 0 ? <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No records. Upload a report to start.</TableCell></TableRow>
            : records.map((r) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedRecord(r)}>
                <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} /></TableCell>
                <TableCell>{r.renewal_effective_date}</TableCell>
                <TableCell className="font-medium">{r.first_name} {r.last_name}</TableCell>
                <TableCell className="font-mono text-sm">{r.policy_number}</TableCell>
                <TableCell>{r.product_name}</TableCell>
                <TableCell className="text-right">${r.premium_new?.toLocaleString() ?? '-'}</TableCell>
                <TableCell className={`text-right ${(r.premium_change_percent || 0) > 0 ? 'text-red-600' : (r.premium_change_percent || 0) < 0 ? 'text-green-600' : ''}`}>{r.premium_change_percent != null ? `${r.premium_change_percent > 0 ? '+' : ''}${r.premium_change_percent.toFixed(1)}%` : '-'}</TableCell>
                <TableCell><Badge variant={r.multi_line_indicator ? 'default' : 'secondary'}>{r.multi_line_indicator ? 'Yes' : 'No'}</Badge></TableCell>
                <TableCell><Badge className={STATUS_COLORS[r.current_status]}>{r.current_status}</Badge></TableCell>
                <TableCell>{r.assigned_team_member?.name || '—'}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setSelectedRecord(r)}>View</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <RenewalUploadModal open={showUploadModal} onClose={() => setShowUploadModal(false)} context={context} />
      <RenewalDetailDrawer record={selectedRecord} open={!!selectedRecord} onClose={() => setSelectedRecord(null)} context={context} teamMembers={teamMembers} />
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Records</AlertDialogTitle><AlertDialogDescription>Delete {selectedIds.size} record(s)?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
