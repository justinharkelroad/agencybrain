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
import { ProspectEditModal } from "@/components/ProspectEditModal";

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
  zip?: string | null;
  notes?: string | null;
  email?: string | null;
  phone?: string | null;
  items_quoted: number;
  policies_quoted: number;
  premium_potential_cents: number;
  status?: string;
  custom_fields?: Record<string, { label: string; type: string; value: string }>;
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
}

export default function Explorer() {
  const { user } = useAuth();

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

  const search = async (page: number = 1) => {
    if (!user) return;
    
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
        sortOrder: sortOrder
      });

      if (page === 1) {
        // Replace results for new search
        setRows(data.rows);
        setHasMore(data.page < Math.ceil(data.total / data.pageSize));
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

    const headers = ["Date", "Staff", "Household", "Lead Source", "ZIP", "#Items", "#Policies", "Premium Potential", "Notes", "Email", "Phone"];
    const csvRows = rows.map(row => {
      const values = [
        row.work_date || row.created_at?.split('T')[0] || "",
        row.staff_member_name || "Unknown",
        row.prospect_name || "",
        row.lead_source_label || "Undefined",
        row.zip || "",
        row.items_quoted?.toString() || "0",
        row.policies_quoted?.toString() || "0", 
        (row.premium_potential_cents / 100).toFixed(2),
        (row.notes || "").replace(/\n/g, " ").replace(/"/g, '""'), // Escape quotes and newlines
        row.email || "",
        row.phone || ""
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
    const apiValue = (value === "all") ? "" : value;
    setFilters(prev => ({ ...prev, [key]: apiValue }));
  };

  const SortHeader = ({ field, label }: { field: string; label: string }) => {
    const active = sortBy === field;
    const dirIcon = !active ? null : sortOrder === "desc" ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />;
    const onClick = () => {
      if (active) setSortOrder(sortOrder === "desc" ? "asc" : "desc");
      else { setSortBy(field); setSortOrder("desc"); } // default desc on new field
      // Reset to page 1 and search with new sort
      setCurrentPage(1);
      search(1);
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
      if (!user) return;

      try {
        // Get user's agency
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .single();

        if (profile?.agency_id) {
          // Set agency ID for modal
          setAgencyIdForModal(profile.agency_id);

          // Get team members
          const { data: members } = await supabase
            .from('team_members')
            .select('id, name')
            .eq('agency_id', profile.agency_id)
            .eq('status', 'active');

          setTeamMembers(members || []);

          // Get lead sources
          const { data: sources } = await supabase
            .from('lead_sources')
            .select('id, name')
            .eq('agency_id', profile.agency_id)
            .eq('is_active', true);

          setLeadSources(sources || []);
        }
      } catch (error) {
        console.error('Error fetching agency data:', error);
      }
    };

    fetchAgencyData();
  }, [user]);

  // Initial search when user is available
  useEffect(() => {
    if (user) {
      search(1);
      setCurrentPage(1);
    }
  }, [user]);

  // Refetch when sort changes
  useEffect(() => {
    if (user) {
      search(1);
      setCurrentPage(1);
    }
  }, [sortBy, sortOrder]);

  if (!user) {
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
          <p className="text-muted-foreground">Search and analyze quoted household data</p>
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
                placeholder='Search household (jo*, "john doe", or fuzzy search)'
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

          {/* Staff and Lead Source Dropdowns */}
          <div className="grid gap-3 md:grid-cols-2">
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
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Results ({rows.length} households)</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={!hasMore || loading}
              >
                Load More
              </Button>
              <Button
                variant="outline"
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
              <p className="text-muted-foreground">No households found matching your criteria.</p>
            </div>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium w-12">Edit</th>
                    <SortHeader field="created_at" label="Date" />
                    <th className="text-left p-3 font-medium">Staff</th>
                    <SortHeader field="prospect_name" label="Household" />
                    <th className="text-left p-3 font-medium">Lead Source</th>
                    <SortHeader field="items_quoted" label="#Items" />
                    <SortHeader field="policies_quoted" label="#Policies" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-muted/50">
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
                      <td className="p-3">{row.work_date || row.created_at?.split('T')[0] || "—"}</td>
                      <td className="p-3">
                        {row.staff_member_name || "Unknown"}
                      </td>
                      <td className="p-3 font-medium">{row.prospect_name}</td>
                      <td className="p-3">
                        {row.lead_source_label === "Undefined" ? (
                          <Badge variant="outline" className="text-xs">
                            Undefined
                          </Badge>
                        ) : (
                          row.lead_source_label || "—"
                        )}
                      </td>
                      <td className="p-3">{row.items_quoted || 0}</td>
                      <td className="p-3">{row.policies_quoted || 0}</td>
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

      <ProspectEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedHousehold(null);
        }}
        onSave={() => {
          // Refresh the search results after saving
          search();
        }}
        prospect={selectedHousehold}
        teamMembers={teamMembers}
        leadSources={leadSources}
        agencyId={agencyIdForModal}
      />
    </div>
  );
}