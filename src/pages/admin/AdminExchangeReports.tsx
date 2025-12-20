import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Flag, Trash2, Check, ExternalLink, AlertTriangle } from 'lucide-react';
import { SidebarLayout } from '@/components/SidebarLayout';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useExchangeReports, useResolveReport, useDeleteReportedPost } from '@/hooks/useExchangeReports';
import { useNavigate } from 'react-router-dom';

export default function AdminExchangeReports() {
  const navigate = useNavigate();
  const { data: reports, isLoading, error } = useExchangeReports();
  const resolveReport = useResolveReport();
  const deletePost = useDeleteReportedPost();
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ reportId: string; postId: string } | null>(null);
  
  const openReports = reports?.filter(r => !r.resolved_at) || [];
  const resolvedReports = reports?.filter(r => r.resolved_at) || [];

  return (
    <SidebarLayout>
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Exchange Reports</h1>
            <p className="text-muted-foreground">Manage reported content in The Exchange</p>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : error ? (
            <Card className="border-destructive/30">
              <CardContent className="pt-6 text-center text-destructive">
                Failed to load reports
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Open Reports */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Open Reports
                    {openReports.length > 0 && (
                      <Badge variant="destructive">{openReports.length}</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>Reports that need your attention</CardDescription>
                </CardHeader>
                <CardContent>
                  {openReports.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No open reports</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reporter</TableHead>
                          <TableHead>Post Content</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {openReports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{report.reporter?.full_name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{report.reporter?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs">
                                <p className="text-sm truncate">
                                  {report.post?.content_text || report.post?.file_name || 'No content'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  By: {report.post?.user?.full_name || report.post?.user?.email || 'Unknown'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm max-w-xs truncate">{report.reason}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm text-muted-foreground">
                                {format(parseISO(report.created_at), 'MMM d, yyyy')}
                              </p>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/exchange?post=${report.post_id}`)}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resolveReport.mutate(report.id)}
                                  disabled={resolveReport.isPending}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Dismiss
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeleteConfirm({ reportId: report.id, postId: report.post_id })}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete Post
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              
              {/* Resolved Reports */}
              {resolvedReports.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-500" />
                      Resolved Reports
                    </CardTitle>
                    <CardDescription>Previously handled reports</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reporter</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Reported</TableHead>
                          <TableHead>Resolved</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resolvedReports.slice(0, 10).map((report) => (
                          <TableRow key={report.id} className="opacity-60">
                            <TableCell>{report.reporter?.full_name || report.reporter?.email}</TableCell>
                            <TableCell className="max-w-xs truncate">{report.reason}</TableCell>
                            <TableCell>{format(parseISO(report.created_at), 'MMM d, yyyy')}</TableCell>
                            <TableCell>{report.resolved_at && format(parseISO(report.resolved_at), 'MMM d, yyyy')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reported Post</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the post and resolve the report. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm) {
                  deletePost.mutate(deleteConfirm);
                  setDeleteConfirm(null);
                }
              }}
            >
              Delete Post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarLayout>
  );
}
