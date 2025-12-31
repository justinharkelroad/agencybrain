import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Eye, Search, TrendingUp, Building2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface RoleplaySession {
  id: string;
  staff_name: string;
  staff_email: string;
  completed_at: string;
  overall_score: string;
  pdf_file_path: string;
  grading_data: any;
  conversation_transcript: any[];
  agency_id: string;
  agency?: {
    id: string;
    name: string;
  };
  token: {
    created_at: string;
    created_by: string;
  };
}

export default function RoleplayReports() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<RoleplaySession | null>(null);

  // Fetch all agencies for the filter dropdown
  const { data: agencies } = useQuery({
    queryKey: ['all-agencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Fetch ALL roleplay sessions (admin sees all agencies)
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['roleplay-sessions-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roleplay_sessions')
        .select(`
          *,
          agency:agencies!agency_id(id, name),
          token:roleplay_access_tokens!token_id(created_at, created_by)
        `)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      return data as RoleplaySession[];
    },
    enabled: !!user?.id
  });

  // Filter by search term and selected agency
  const filteredSessions = sessions?.filter(session => {
    const matchesSearch = 
      session.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.staff_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.agency?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAgency = selectedAgency === "all" || session.agency_id === selectedAgency;
    
    return matchesSearch && matchesAgency;
  });

  const handleDownloadPDF = async (session: RoleplaySession) => {
    try {
      const { data, error } = await supabase.storage
        .from('roleplay-pdfs')
        .download(session.pdf_file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roleplay-${session.staff_name.replace(/\s+/g, '-')}-${format(new Date(session.completed_at), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download PDF');
    }
  };

  const getScoreBadgeVariant = (score: string) => {
    switch (score) {
      case 'Excellent': return 'default';
      case 'Good': return 'secondary';
      case 'Needs Improvement': return 'outline';
      case 'Poor': return 'destructive';
      default: return 'outline';
    }
  };

  // Stats based on filtered sessions (respects agency filter)
  const stats = {
    total: filteredSessions?.length || 0,
    excellent: filteredSessions?.filter(s => s.overall_score === 'Excellent').length || 0,
    good: filteredSessions?.filter(s => s.overall_score === 'Good').length || 0,
    needsImprovement: filteredSessions?.filter(s => s.overall_score === 'Needs Improvement').length || 0,
  };

  return (
    <>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Roleplay Reports</h1>
            <p className="text-muted-foreground">
              View completed sales roleplay sessions across all agencies
            </p>
          </div>
          
          {/* Agency Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedAgency} onValueChange={setSelectedAgency}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filter by agency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agencies</SelectItem>
                {agencies?.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Excellent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.excellent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Good</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.good}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.needsImprovement}</div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Completed Sessions</CardTitle>
          <CardDescription>
            {selectedAgency === "all" 
              ? "All completed roleplay sessions across all agencies" 
              : `Roleplay sessions for ${agencies?.find(a => a.id === selectedAgency)?.name || 'selected agency'}`
            }
          </CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or agency..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
          ) : filteredSessions && filteredSessions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agency</TableHead>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {session.agency?.name || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{session.staff_name}</TableCell>
                      <TableCell>{session.staff_email}</TableCell>
                      <TableCell>
                        {format(new Date(session.completed_at), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getScoreBadgeVariant(session.overall_score)}>
                          {session.overall_score}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedSession(session)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadPDF(session)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No sessions found matching your search' : 'No completed sessions yet'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Roleplay Session Details</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Agency</p>
                  <p className="font-medium">{selectedSession.agency?.name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Staff Name</p>
                  <p className="font-medium">{selectedSession.staff_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedSession.staff_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="font-medium">
                    {format(new Date(selectedSession.completed_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overall Score</p>
                  <Badge variant={getScoreBadgeVariant(selectedSession.overall_score)}>
                    {selectedSession.overall_score}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Performance Breakdown</h3>
                {Object.entries(selectedSession.grading_data).map(([key, value]: [string, any]) => {
                  if (key === 'overall_score' || !value.score) return null;
                  
                  const sectionTitles: Record<string, string> = {
                    greeting: 'Greeting & Introduction',
                    needs_discovery: 'Needs Discovery',
                    product_knowledge: 'Product Knowledge',
                    objection_handling: 'Objection Handling',
                    closing: 'Closing Technique'
                  };

                  return (
                    <Card key={key}>
                      <CardHeader>
                        <CardTitle className="text-base">{sectionTitles[key]}</CardTitle>
                        <CardDescription>Score: {value.score}/5</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {value.strengths && value.strengths.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-green-600 mb-1">Strengths</p>
                            <ul className="list-disc list-inside space-y-1">
                              {value.strengths.map((strength: string, i: number) => (
                                <li key={i} className="text-sm">{strength}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {value.improvements && value.improvements.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-red-600 mb-1">Areas for Improvement</p>
                            <ul className="list-disc list-inside space-y-1">
                              {value.improvements.map((improvement: string, i: number) => (
                                <li key={i} className="text-sm">{improvement}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Button onClick={() => handleDownloadPDF(selectedSession)} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Full Report
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
