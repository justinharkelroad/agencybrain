import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { fetchExplorerData, ExplorerQuery } from "@/lib/explorer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchIcon, DownloadIcon, FilterIcon, EditIcon, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { ProspectViewModal } from "@/components/ProspectViewModal";

interface QuotedHousehold {
  id: string;
  submission_id?: string;
  form_template_id?: string;
  team_member_id?: string;
  work_date?: string;
  created_at: string;
  prospect_name: string;
  staff_member_name?: string;
  lead_source_label?: string | null;
  items_quoted: number | null;
  policies_quoted: number | null;
  premium_potential_cents: number;
  status?: string;
  custom_fields?: Record<string, { label: string; type: string; value: string }>;
  record_type?: "prospect" | "customer";
  policy_type?: string[];
}

interface SearchFilters {
  q: string;
  start: string;
  end: string;
  staffId: string;
  leadSource: string;
  finalOnly: boolean;
  includeSuperseded: boolean;
  lateOnly: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  recordType: "all" | "prospect" | "customer";
}

interface ExplorerProps {
  staffAgencyId?: string | null;
}

export default function Explorer({ staffAgencyId }: ExplorerProps) {
  const { user } = useAuth();
  const isStaffMode = !!staffAgencyId;

  // Default to current month (1st to today)
  const getCurrentMonthRange = () => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      start: firstOfMonth.toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10)
    };
  };

  const monthRange = getCurrentMonthRange();
  const [filters, setFilters] = useState<SearchFilters>({
    q: "",
    start: monthRange.start,
    end: monthRange.end,
    staffId: "",
    leadSource: "",
    finalOnly: true,
    includeSuperseded: false,
    lateOnly: false,
    recordType: "all",
  });

  const [rows, setRows] = useState<QuotedHousehold[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{id: string, name: string}>>([]);
  const [leadSources, setLeadSources] = useState<Array<{id: string, name: string}>>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [agencyIdForModal, setAgencyIdForModal] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [prospectCount, setProspectCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  const search = async (page: number = 1) => {
    if (!user && !isStaffMode) return;
    
    setLoading(true);
    setError(null);

    try {
      const data = await fetchExplorerData({
        page,
        pageSize: 50,
        query: filters.q || undefined,
        start: filters.start || undefined,
        end: filters.end || undefined,
        staffId: filters.staffId || undefined,
        leadSource: filters.leadSource || undefined,
        finalOnly: filters.finalOnly,
        includeSuperseded: filters.includeSuperseded,
        lateOnly: filters.lateOnly,
        sortBy: sortBy,
        sortOrder: sortOrder,
        recordType: filters.recordType
      });

      if (page === 1) {
        // Replace results for new search
        setRows(data.rows);
        setHasMore(data.page < Math.ceil(data.total / data.pageSize));
        setProspectCount(data.prospectCount || 0);
        setCustomerCount(data.customerCount || 0);
      } else {
        // Append to existing results for "Load more"
        setRows(prevRows => [...prevRows, ...data.rows]);
        setHasMore(page < Math.ceil(data.total / data.pageSize));
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : "Search failed");
      toast.error("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    search(1);
  };

  const [currentPage, setCurrentPage] = useState(1);

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      search(nextPage);
    }
  };

  const exportCsv = () => {
    if (!rows.length) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Type", "Date", "Staff", "Household", "Lead Source", "#Items", "#Policies", "Premium", "Policy Types"];
    const csvRows = rows.map(row => {
      const values = [
        row.record_type === "customer" ? "Sold" : "Quoted",
        row.work_date || row.created_at?.split('T')[0] || "",
        row.staff_member_name || "Unknown",
        row.prospect_name || "",
        row.lead_source_label || "Undefined",
        row.items_quoted?.toString() || "—",
        row.policies_quoted?.toString() || "—", 
        (row.premium_potential_cents / 100).toFixed(2),
        row.policy_type?.join(", ") || ""
      ];
      return values.map(value => `"${value}"`).join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `explorer_${filters.start || "all"}_${filters.end || "all"}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  const updateFilter = (key: keyof SearchFilters, value: string | boolean) => {
    // Handle "all" values as empty strings for API
    const apiValue = (value === "all" && key !== "recordType") ? "" : value;
    setFilters(prev => ({ ...prev, [key]: apiValue }));
  };

  // Column to database field mapping
  const SORT_FIELDS = {
    date: "created_at",           // Date column shows created_at
    household: "household_name",
    items: "items_quoted",
    policies: "policies_quoted",
    premium: "premium_potential_cents",
  } as const;

  const SortHeader = ({ field, label }: { field: keyof typeof SORT_FIELDS; label: string }) => {
    const dbField = SORT_FIELDS[field];
    const active = sortBy === dbField;
    const dirIcon = !active ? null : sortOrder === "desc" ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />;
    const onClick = () => {
      if (active) setSortOrder(sortOrder === "desc" ? "asc" : "desc");
      else { setSortBy(dbField); setSortOrder("desc"); } // default desc on new field
      // Reset to page 1 - search will be triggered by useEffect
      setCurrentPage(1);
    };
    return (
      <th onClick={onClick} className="cursor-pointer select-none p-3 hover:bg-muted/30">
        <div className="flex items-center gap-1">{label}{dirIcon}</div>
      </th>
    );
  };

  // Convert API data format to modal format
  const convertToModalFormat = (row: QuotedHousehold): any => {
    return {
      ...row,
      household_name: row.prospect_name,
      lead_source: row.lead_source_label,
      is_final: row.status === "final",
      is_late: false, // Not provided by new API
      submission_id: row.submission_id || "",
      form_template_id: row.form_template_id || "",
      team_member_id: row.team_member_id || "",
      work_date: row.work_date || row.created_at?.split('T')[0] || ""
    };
  };

  // Fetch agency slug and related data
  useEffect(() => {
    const fetchAgencyData = async () => {
      // Skip if we don't have user or staffAgencyId
      if (!user && !isStaffMode) return;

      try {
        let agencyId = staffAgencyId;
        
        // Only query profiles if we don't have staffAgencyId
        if (!agencyId && user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('agency_id')
            .eq('id', user.id)
            .single();
          agencyId = profile?.agency_id;
        }

        if (agencyId) {
          // Set agency ID for modal
          setAgencyIdForModal(agencyId);

          // Get team members
          const { data: members } = await supabase
            .from('team_members')
            .select('id, name')
            .eq('agency_id', agencyId)
            .eq('status', 'active');

          setTeamMembers(members || []);

          // Get lead sources
          const { data: sources } = await supabase
            .from('lead_sources')
            .select('id, name')
            .eq('agency_id', agencyId)
            .eq('is_active', true);

          setLeadSources(sources || []);
        }
      } catch (error) {
        console.error('Error fetching agency data:', error);
      }
    };

    fetchAgencyData();
  }, [user, staffAgencyId, isStaffMode]);

  // Initial search when user is available or staff mode
  useEffect(() => {
    if (user || isStaffMode) {
      search(1);
      setCurrentPage(1);
    }
  }, [user, isStaffMode]);

  // Refetch when sort changes
  useEffect(() => {
    if ((user || isStaffMode) && (sortBy !== "created_at" || sortOrder !== "desc")) {
      search(1);
      setCurrentPage(1);
    }
  }, [sortBy, sortOrder]);

  // Refetch when record type filter changes
  useEffect(() => {
    if (user || isStaffMode) {
      search(1);
      setCurrentPage(1);
    }
  }, [filters.recordType]);

  // For staff users, skip the "please log in" message - they authenticate differently
  if (!user && !isStaffMode) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to access the Explorer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Explorer</h1>
          <p className="text-muted-foreground">Search and analyze prospects and customers</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilterIcon className="h-5 w-5" />
            Search Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder='Search by name (jo*, "john doe", or fuzzy search)'
                value={filters.q}
                onChange={(e) => updateFilter("q", e.target.value)}
                className="w-full"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              <SearchIcon className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          {/* Date Range */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={filters.start}
                onChange={(e) => updateFilter("start", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={filters.end}
                onChange={(e) => updateFilter("end", e.target.value)}
              />
            </div>
          </div>

          {/* Staff, Lead Source, and Record Type Dropdowns */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Staff Member</label>
              <Select
                value={filters.staffId}
                onValueChange={(value) => updateFilter("staffId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All staff members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff members</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Lead Source</label>
              <Select
                value={filters.leadSource}
                onValueChange={(value) => updateFilter("leadSource", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All lead sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All lead sources</SelectItem>
                  <SelectItem value="Undefined">Undefined</SelectItem>
                  {leadSources.map((source) => (
                    <SelectItem key={source.id} value={source.name}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Record Type</label>
              <Select
                value={filters.recordType}
                onValueChange={(value) => updateFilter("recordType", value as "all" | "prospect" | "customer")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All records" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Records</SelectItem>
                  <SelectItem value="prospect">Prospects Only (Quoted)</SelectItem>
                  <SelectItem value="customer">Customers Only (Sold)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <CardTitle>Results ({rows.length} records)</CardTitle>
              <div className="flex gap-2 text-sm">
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {prospectCount} Prospects
                </Badge>
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
                  {customerCount} Customers
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="flat"
                onClick={handleLoadMore}
                disabled={!hasMore || loading}
              >
                Load More
              </Button>
              <Button
                variant="flat"
                onClick={exportCsv}
                disabled={!rows.length}
              >
                <DownloadIcon className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && rows.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-destructive">Error: {error}</p>
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No records found matching your criteria.</p>
            </div>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium w-12">Edit</th>
                    <th className="text-left p-3 font-medium w-20">Type</th>
                    <SortHeader field="date" label="Date" />
                    <th className="text-left p-3 font-medium">Staff</th>
                    <SortHeader field="household" label="Name" />
                    <th className="text-left p-3 font-medium">Lead Source</th>
                    <SortHeader field="items" label="#Items" />
                    <SortHeader field="policies" label="#Policies" />
                    <SortHeader field="premium" label="Premium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr 
                      key={row.id} 
                      className={`border-b hover:bg-muted/50 ${
                        row.record_type === "customer" ? "bg-green-500/5" : ""
                      }`}
                    >
                      <td className="p-3">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedHousehold(convertToModalFormat(row));
                            setIsEditModalOpen(true);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <EditIcon className="h-4 w-4" />
                        </Button>
                      </td>
                      <td className="p-3">
                        {row.record_type === "customer" ? (
                          <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
                            Sold
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                            Quoted
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">{row.created_at?.split('T')[0] || "—"}</td>
                      <td className="p-3">
                        {row.staff_member_name || "Unknown"}
                      </td>
                      <td className="p-3 font-medium">{row.prospect_name}</td>
                      <td className="p-3">
                        {(() => {
                          const label = row.lead_source_label;
                          // Check if it's a UUID pattern and resolve to name
                          if (label && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(label)) {
                            const resolved = leadSources.find(ls => ls.id === label)?.name;
                            return resolved || label;
                          }
                          if (label === "Undefined") {
                            return (
                              <Badge variant="outline" className="text-xs">
                                Undefined
                              </Badge>
                            );
                          }
                          return label || "—";
                        })()}
                      </td>
                      <td className="p-3">{row.items_quoted ?? "—"}</td>
                      <td className="p-3">{row.policies_quoted ?? "—"}</td>
                      <td className="p-3">
                        {row.premium_potential_cents 
                          ? `$${(row.premium_potential_cents / 100).toLocaleString()}`
                          : "—"
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loading && rows.length > 0 && (
            <div className="text-center py-4">
              <p className="text-muted-foreground text-sm">Loading more...</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ProspectViewModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedHousehold(null);
        }}
        prospect={selectedHousehold}
        teamMembers={teamMembers}
        leadSources={leadSources}
      />
    </div>
  );
}
