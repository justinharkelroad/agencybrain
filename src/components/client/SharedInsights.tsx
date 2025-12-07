
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Eye, CheckCircle2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCategoryGradient } from '@/utils/categoryStyles';

interface AnalysisRow {
  id: string;
  analysis_type: string;
  analysis_result: string;
  created_at: string;
  shared_with_client: boolean;
  period_id: string | null;
  user_id: string | null;
  prompt_used: string;
  selected_uploads: any[] | null;
}

interface AnalysisView {
  id: string;
  analysis_id: string;
  user_id: string;
  view_count: number;
  first_viewed_at: string;
  last_viewed_at: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

const SharedInsights: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [views, setViews] = useState<Record<string, AnalysisView | null>>({});
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisRow | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [messagesLoading, setMessagesLoading] = useState<Record<string, boolean>>({});
  
  // Pagination state
  const [needsReviewPage, setNeedsReviewPage] = useState(0);
  const [completedPage, setCompletedPage] = useState(0);
  const itemsPerPage = 2;

  useEffect(() => {
    if (!user) return;
    fetchSharedAnalyses();
  }, [user?.id]);

  const fetchSharedAnalyses = async () => {
    // RLS ensures we only get shared rows for this user
    const { data, error } = await supa
      .from('ai_analysis')
      .select('*')
      .eq('shared_with_client', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading shared insights:', error);
      toast({ title: 'Error', description: 'Failed to load shared insights', variant: 'destructive' });
      return;
    }

    const rows = (data || []) as AnalysisRow[];
    setAnalyses(rows);

    if (rows.length && user) {
      const ids = rows.map(r => r.id);
      const { data: vData, error: vErr } = await supa
        .from('ai_analysis_views')
        .select('*')
        .eq('user_id', user.id)
        .in('analysis_id', ids);
      if (vErr) {
        console.error('Error loading views:', vErr);
        return;
      }
      const map: Record<string, AnalysisView | null> = {};
      ids.forEach(id => map[id] = null);
      (vData || []).forEach((v) => { map[v.analysis_id] = v as AnalysisView; });
      setViews(map);
    } else {
      setViews({});
    }
  };

  const needsReview = useMemo(() => {
    return analyses.filter(a => !views[a.id]?.acknowledged);
  }, [analyses, views]);

  const completed = useMemo(() => {
    return analyses.filter(a => views[a.id]?.acknowledged);
  }, [analyses, views]);

  // Paginated data
  const paginatedNeedsReview = useMemo(() => {
    const start = needsReviewPage * itemsPerPage;
    return needsReview.slice(start, start + itemsPerPage);
  }, [needsReview, needsReviewPage]);

  const paginatedCompleted = useMemo(() => {
    const start = completedPage * itemsPerPage;
    return completed.slice(start, start + itemsPerPage);
  }, [completed, completedPage]);

  const needsReviewTotalPages = Math.ceil(needsReview.length / itemsPerPage);
  const completedTotalPages = Math.ceil(completed.length / itemsPerPage);

  const recordView = async (analysis: AnalysisRow) => {
    if (!user) return;

    const { data: existing, error: selErr } = await supa
      .from('ai_analysis_views')
      .select('*')
      .eq('user_id', user.id)
      .eq('analysis_id', analysis.id)
      .maybeSingle();

    if (selErr) {
      console.error('Error checking view record:', selErr);
      return;
    }

    if (existing) {
      const { data: upd, error: updErr } = await supa
        .from('ai_analysis_views')
        .update({
          view_count: (existing.view_count || 0) + 1,
          last_viewed_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (!updErr) {
        setViews(prev => ({ ...prev, [analysis.id]: upd as AnalysisView }));
      }
    } else {
      const { data: ins, error: insErr } = await supa
        .from('ai_analysis_views')
        .insert({
          analysis_id: analysis.id,
          user_id: user.id,
          view_count: 1,
          first_viewed_at: new Date().toISOString(),
          last_viewed_at: new Date().toISOString(),
          acknowledged: false
        })
        .select()
        .single();
      if (!insErr) {
        setViews(prev => ({ ...prev, [analysis.id]: ins as AnalysisView }));
      }
    }
  };

  const acknowledge = async (analysis: AnalysisRow) => {
    if (!user) return;

    const current = views[analysis.id];
    if (current) {
      const { data, error } = await supa
        .from('ai_analysis_views')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', current.id)
        .select()
        .single();
      if (!error) {
        setViews(prev => ({ ...prev, [analysis.id]: data as AnalysisView }));
        toast({ title: 'Acknowledged', description: 'Marked as completed.' });
      }
    } else {
      const { data, error } = await supa
        .from('ai_analysis_views')
        .insert({
          analysis_id: analysis.id,
          user_id: user.id,
          view_count: 1,
          first_viewed_at: new Date().toISOString(),
          last_viewed_at: new Date().toISOString(),
          acknowledged: true,
          acknowledged_at: new Date().toISOString()
        })
        .select()
        .single();
      if (!error) {
        setViews(prev => ({ ...prev, [analysis.id]: data as AnalysisView }));
        toast({ title: 'Acknowledged', description: 'Marked as completed.' });
      }
    }
  };

  const loadMessages = async (analysisId: string) => {
    if (messagesLoading[analysisId]) return;
    setMessagesLoading(prev => ({ ...prev, [analysisId]: true })); console.log('[SharedInsights] loadMessages start', { analysisId });
    try {
      const { data, error } = await supa
        .from('ai_chat_messages')
        .select('id, role, content, created_at')
        .eq('analysis_id', analysisId)
        .eq('shared_with_client', true)
        .eq('role', 'assistant')
        .order('created_at', { ascending: true });
      if (error) {
        console.error('Error loading shared follow-ups:', error);
        setMessages(prev => ({ ...prev, [analysisId]: [] }));
      } else {
        console.log('[SharedInsights] loaded messages', { analysisId, count: (data as any[])?.length ?? 0 }); setMessages(prev => ({ ...prev, [analysisId]: (data as any[]) || [] }));
      }
    } finally {
      setMessagesLoading(prev => ({ ...prev, [analysisId]: false }));
    }
  };


  return (
    <Card className="border-border/10 bg-muted/20">
        <CardHeader>
          <CardTitle className="font-medium">Shared Insights</CardTitle>
        </CardHeader>
      <CardContent>
        {analyses.length === 0 ? (
          <p className="text-sm text-muted-foreground/70">No insights have been shared with you yet from your Coach.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium mb-3">Needs Your Review</h4>
              <div className="space-y-3">
                {paginatedNeedsReview.length === 0 && (
                  <p className="text-xs text-muted-foreground/70">You're all caught up.</p>
                )}
                {paginatedNeedsReview.map(a => (
                  <div key={a.id} className="border-border/10 bg-muted/30 rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground/70 font-normal">
                          {a.analysis_type}
                        </span>
                        <span className="text-xs text-muted-foreground/70">{new Date(a.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                          <Eye className="w-3 h-3" strokeWidth={1.5} />
                          {views[a.id]?.view_count ?? 0}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Dialog
                        open={activeAnalysis?.id === a.id}
                        onOpenChange={(open) => {
                          console.log('[SharedInsights] dialog open', { analysisId: a.id, open }); if (open) {
                            setActiveAnalysis(a);
                            recordView(a);
                            loadMessages(a.id);
                          } else {
                            setActiveAnalysis(null);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">View insight</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <span className="capitalize">{a.analysis_type}</span>
                              <Badge variant="outline">Shared</Badge>
                            </DialogTitle>
                          </DialogHeader>
                          <div className="prose prose-sm max-w-none">
                            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/50 text-foreground border border-border rounded-md p-3">{a.analysis_result}</pre>
                          </div>
                          <div className="mt-6">
                            <div className="text-sm font-medium mb-2">Shared follow-ups</div>
                            {messagesLoading[a.id] ? (
                              <p className="text-xs text-muted-foreground">Loading...</p>
                            ) : messages[a.id]?.length ? (
                              <div className="space-y-3">
                                {messages[a.id]!.map((m) => (
                                  <div key={m.id} className="rounded-md border p-3">
                                    <div className="text-xs text-muted-foreground mb-1">{new Date(m.created_at).toLocaleString()}</div>
                                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/50 text-foreground border border-border rounded-md p-3">{m.content}</pre>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No shared follow-ups.</p>
                            )}
                          </div>
                          <div className="mt-4">
                            <Button onClick={() => acknowledge(a)} variant="ghost" className="w-full text-muted-foreground hover:text-foreground">
                              <CheckCircle2 className="w-4 h-4 mr-2" strokeWidth={1.5} />
                              Acknowledge
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Needs Review Pagination */}
              {needsReview.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setNeedsReviewPage(Math.max(0, needsReviewPage - 1))}
                    disabled={needsReviewPage === 0}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" strokeWidth={1.5} />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground/70">
                    Page {needsReviewPage + 1} of {needsReviewTotalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setNeedsReviewPage(Math.min(needsReviewTotalPages - 1, needsReviewPage + 1))}
                    disabled={needsReviewPage >= needsReviewTotalPages - 1}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" strokeWidth={1.5} />
                  </Button>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium mb-3">Completed</h4>
              <div className="space-y-3">
                {paginatedCompleted.length === 0 && (
                  <p className="text-xs text-muted-foreground/70">No completed items yet.</p>
                )}
                {paginatedCompleted.map(a => (
                  <div key={a.id} className="border-border/10 bg-muted/30 rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground/70 font-normal">
                          {a.analysis_type}
                        </span>
                        <span className="text-xs text-muted-foreground/70">{new Date(a.created_at).toLocaleDateString()}</span>
                      </div>
                      <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                        <Clock className="w-3 h-3" strokeWidth={1.5} />
                        {views[a.id]?.acknowledged_at ? new Date(views[a.id]!.acknowledged_at!).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div className="mt-3">
                      <Dialog
                        open={activeAnalysis?.id === a.id}
                        onOpenChange={(open) => {
                           console.log('[SharedInsights] dialog open', { analysisId: a.id, open }); if (open) {
                            setActiveAnalysis(a);
                            recordView(a);
                            loadMessages(a.id);
                          } else {
                            setActiveAnalysis(null);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">View again</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <span className="capitalize">{a.analysis_type}</span>
                              <Badge variant="outline">Shared</Badge>
                            </DialogTitle>
                          </DialogHeader>
                          <div className="prose prose-sm max-w-none">
                            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/50 text-foreground border border-border rounded-md p-3">{a.analysis_result}</pre>
                          </div>
                          <div className="mt-6">
                            <div className="text-sm font-medium mb-2">Shared follow-ups</div>
                            {messagesLoading[a.id] ? (
                              <p className="text-xs text-muted-foreground">Loading...</p>
                            ) : messages[a.id]?.length ? (
                              <div className="space-y-3">
                                {messages[a.id]!.map((m) => (
                                  <div key={m.id} className="rounded-md border p-3">
                                    <div className="text-xs text-muted-foreground mb-1">{new Date(m.created_at).toLocaleString()}</div>
                                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/50 text-foreground border border-border rounded-md p-3">{m.content}</pre>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No shared follow-ups.</p>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Completed Pagination */}
              {completed.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setCompletedPage(Math.max(0, completedPage - 1))}
                    disabled={completedPage === 0}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" strokeWidth={1.5} />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground/70">
                    Page {completedPage + 1} of {completedTotalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setCompletedPage(Math.min(completedTotalPages - 1, completedPage + 1))}
                    disabled={completedPage >= completedTotalPages - 1}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" strokeWidth={1.5} />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SharedInsights;
