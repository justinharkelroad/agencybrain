import { useEffect, useState } from "react";
import { supa } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchIcon, DownloadIcon, FilterIcon } from "lucide-react";
import { toast } from "sonner";
import { ViewDetailsModal } from "@/components/ViewDetailsModal";

interface QuotedHousehold {
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
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [agencySlug, setAgencySlug] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<Array<{id: string, name: string}>>([]);
  const [leadSources, setLeadSources] = useState<Array<{id: string, name: string}>>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<QuotedHousehold | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const search = async (cursor?: string) => {
    if (!user) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data: session } = await supa.auth.getSession();
      const token = session.session?.access_token ?? "";

      const response = await supa.functions.invoke('explorer_feed', {
        body: {
          agencySlug,
          ...filters,
          cursor,
          limit: 50
        }
      });
      
      if (response.error) {
        throw new Error(response.error.message || "Search failed");
      }

      const data = response.data;
      setNextCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);

      if (cursor) {
        // Append to existing results for "Load more"
        setRows(prevRows => [...prevRows, ...data.rows]);
      } else {
        // Replace results for new search
        setRows(data.rows);
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
    search();
  };

  const handleLoadMore = () => {
    if (nextCursor && !loading) {
      search(nextCursor);
    }
  };

  const exportCsv = () => {
    if (!rows.length) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Date", "Staff", "Household", "Lead Source", "ZIP", "#Items", "#Policies", "Premium Potential", "Notes"];
    const csvRows = rows.map(row => {
      const values = [
        row.work_date,
        teamMembers.find(m => m.id === row.team_member_id)?.name || row.team_member_id,
        row.household_name || "",
        row.lead_source || "Undefined",
        row.zip || "",
        row.items_quoted?.toString() || "0",
        row.policies_quoted?.toString() || "0", 
        (row.premium_potential_cents / 100).toFixed(2),
        (row.notes || "").replace(/\n/g, " ").replace(/"/g, '""') // Escape quotes and newlines
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

  // Fetch agency slug and related data
  useEffect(() => {
    const fetchAgencyData = async () => {
      if (!user) return;

      try {
        // Get user's agency
        const { data: profile } = await supa
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .single();

        if (profile?.agency_id) {
          // Get agency slug
          const { data: agency } = await supa
            .from('agencies')
            .select('slug')
            .eq('id', profile.agency_id)
            .single();

          if (agency?.slug) {
            setAgencySlug(agency.slug);
          }

          // Get team members
          const { data: members } = await supa
            .from('team_members')
            .select('id, name')
            .eq('agency_id', profile.agency_id)
            .eq('status', 'active');

          setTeamMembers(members || []);

          // Get lead sources
          const { data: sources } = await supa
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

  // Initial search when agency data is loaded
  useEffect(() => {
    if (user && agencySlug) {
      search();
    }
  }, [user, agencySlug]);

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
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Staff</th>
                    <th className="text-left p-3 font-medium">Household</th>
                    <th className="text-left p-3 font-medium">Lead Source</th>
                    <th className="text-left p-3 font-medium">ZIP</th>
                    <th className="text-left p-3 font-medium">#Items</th>
                    <th className="text-left p-3 font-medium">#Policies</th>
                    <th className="text-left p-3 font-medium">Premium Potential</th>
                    <th className="text-left p-3 font-medium">Notes</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">{row.work_date}</td>
                      <td className="p-3">
                        {teamMembers.find(m => m.id === row.team_member_id)?.name || row.team_member_id}
                      </td>
                      <td className="p-3 font-medium">{row.household_name}</td>
                      <td className="p-3">
                        {row.lead_source === "Undefined" ? (
                          <Badge variant="outline" className="text-xs">
                            Undefined
                          </Badge>
                        ) : (
                          row.lead_source || "—"
                        )}
                      </td>
                      <td className="p-3">{row.zip || "—"}</td>
                      <td className="p-3">{row.items_quoted || 0}</td>
                      <td className="p-3">{row.policies_quoted || 0}</td>
                      <td className="p-3">
                        ${((row.premium_potential_cents || 0) / 100).toLocaleString('en-US', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </td>
                      <td className="p-3 max-w-[200px]">
                        <div className="truncate" title={row.notes || ""}>
                          {row.notes || "—"}
                        </div>
                      </td>
                      <td className="p-3">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedHousehold(row);
                            setIsDetailsModalOpen(true);
                          }}
                        >
                          View Details
                        </Button>
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

      <ViewDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedHousehold(null);
        }}
        household={selectedHousehold}
        teamMembers={teamMembers}
        leadSources={leadSources}
      />
    </div>
  );
}