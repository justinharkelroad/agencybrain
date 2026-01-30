import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useSubmissions } from "@/hooks/useSubmissions";
import { Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SubmissionsListProps {
  staffAgencyId?: string | null;
}

export function SubmissionsList({ staffAgencyId }: SubmissionsListProps) {
  const { submissions, loading, getDynamicKpiMetrics } = useSubmissions(staffAgencyId || undefined);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No submissions yet</p>
            <p className="text-sm">Form submissions will appear here once team members start submitting data.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Form Submissions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Form</TableHead>
              <TableHead>Team Member</TableHead>
              <TableHead>Work Date</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Key Metrics</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map((submission) => (
              <TableRow 
                key={submission.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  // Staff users should stay in staff routes to prevent auth collisions
                  if (staffAgencyId) {
                    navigate(`/staff/scorecards/submissions/${submission.id}`);
                  } else {
                    navigate(`/submissions/${submission.id}`);
                  }
                }}
              >
                <TableCell>
                  <div className="font-medium">
                    {submission.form_templates?.name || 'Unknown Form'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {submission.form_templates?.slug}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {submission.team_members?.name || 'Unknown Member'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {submission.team_members?.email}
                  </div>
                </TableCell>
                <TableCell>
                  {format(parseISO(submission.work_date), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  {format(new Date(submission.submitted_at), 'MMM d, yyyy h:mm a')}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {submission.final ? (
                      <Badge variant="default" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Final
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                    {submission.late && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Late
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {(() => {
                    const metrics = getDynamicKpiMetrics(submission);
                    return (
                      <div className="text-sm space-y-1">
                        {metrics.map((metric, index) => (
                          <div key={index} className="flex justify-between gap-2">
                            <span className="text-muted-foreground truncate max-w-[80px]" title={metric.label}>
                              {metric.label}:
                            </span>
                            <span className="font-mono text-xs">{metric.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}