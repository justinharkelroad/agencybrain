import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Download, Eye, TrendingUp, Award, ThumbsUp, AlertTriangle } from "lucide-react";
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
}

export default function RoleplaySessionsCard() {
  const { user } = useAuth();
  const [selectedSession, setSelectedSession] = useState<RoleplaySession | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const { data: totalCount } = useQuery({
    queryKey: ['roleplay-sessions-count', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) throw new Error('No agency ID');
      
      const { count, error } = await supabase
        .from('roleplay_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', profile.agency_id);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.agency_id
  });

  const { data: allSessions } = useQuery({
    queryKey: ['roleplay-sessions-all', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) throw new Error('No agency ID');

      const { data, error } = await supabase
        .from('roleplay_sessions')
        .select('overall_score')
        .eq('agency_id', profile.agency_id);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.agency_id
  });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['roleplay-sessions-dashboard', profile?.agency_id, currentPage],
    queryFn: async () => {
      if (!profile?.agency_id) throw new Error('No agency ID');

      const { data, error } = await supabase
        .from('roleplay_sessions')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .order('completed_at', { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (error) throw error;
      return data as RoleplaySession[];
    },
    enabled: !!profile?.agency_id
  });

  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [profile?.agency_id]);

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

  const stats = {
    total: allSessions?.length || 0,
    excellent: allSessions?.filter(s => s.overall_score === 'Excellent').length || 0,
    good: allSessions?.filter(s => s.overall_score === 'Good').length || 0,
    needsImprovement: allSessions?.filter(s => s.overall_score === 'Needs Improvement').length || 0,
  };

  return (
    <>
      <section aria-labelledby="roleplay-sessions">
        <Card className="border-border/10 bg-muted/20">
          <CardHeader>
            <CardTitle id="roleplay-sessions" className="font-medium">Completed Roleplay Sessions</CardTitle>
            <CardDescription className="text-muted-foreground/70">Recent sales training roleplay performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-4">
              <div className="flex items-center justify-between p-4 border-border/10 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-normal text-muted-foreground/70">Total Sessions</p>
                  <p className="text-2xl font-medium">{stats.total}</p>
                </div>
                <TrendingUp className="h-5 w-5 text-muted-foreground/70" strokeWidth={1.5} />
              </div>
              <div className="flex items-center justify-between p-4 border-border/10 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-normal text-muted-foreground/70">Excellent</p>
                  <p className="text-2xl font-medium text-green-600">{stats.excellent}</p>
                </div>
                <Award className="h-5 w-5 text-muted-foreground/70" strokeWidth={1.5} />
              </div>
              <div className="flex items-center justify-between p-4 border-border/10 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-normal text-muted-foreground/70">Good</p>
                  <p className="text-2xl font-medium text-blue-600">{stats.good}</p>
                </div>
                <ThumbsUp className="h-5 w-5 text-muted-foreground/70" strokeWidth={1.5} />
              </div>
              <div className="flex items-center justify-between p-4 border-border/10 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-normal text-muted-foreground/70">Needs Work</p>
                  <p className="text-2xl font-medium text-amber-600">{stats.needsImprovement}</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-muted-foreground/70" strokeWidth={1.5} />
              </div>
            </div>

            {/* Sessions Table */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
            ) : sessions && sessions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.staff_name}</TableCell>
                      <TableCell>{session.staff_email}</TableCell>
                      <TableCell>
                        {format(new Date(session.completed_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground/70 font-normal">
                          {session.overall_score}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedSession(session)}
                          >
                            <Eye className="h-4 w-4 mr-1" strokeWidth={1.5} />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadPDF(session)}
                          >
                            <Download className="h-4 w-4 mr-1" strokeWidth={1.5} />
                            PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No completed sessions yet. Generate a roleplay link to get started.
              </div>
            )}
            
            {totalPages > 1 && (
              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Detail Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Roleplay Session Details</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
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
    </>
  );
}
