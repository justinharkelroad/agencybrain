import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useSubmissions } from "@/hooks/useSubmissions";
import { Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function SubmissionsList() {
  const { submissions, loading } = useSubmissions();
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
                onClick={() => navigate(`/submissions/${submission.id}`)}
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
                  {format(new Date(submission.work_date), 'MMM d, yyyy')}
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
                  <div className="text-sm">
                    {submission.payload_json && typeof submission.payload_json === 'object' ? (
                      <div className="space-y-1">
                        {Object.entries(submission.payload_json).slice(0, 3).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}:
                            </span>
                            <span className="font-mono text-xs">
                              {typeof value === 'object' ? JSON.stringify(value).slice(0, 20) + '...' : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No data</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}