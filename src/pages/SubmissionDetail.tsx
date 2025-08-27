import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

interface Submission {
  id: string;
  form_template_id: string;
  team_member_id: string;
  submission_date: string;
  work_date: string;
  submitted_at: string;
  payload_json: any;
  late: boolean;
  final: boolean;
  form_templates?: {
    name: string;
    slug: string;
  };
  team_members?: {
    name: string;
    email: string;
  };
}

export default function SubmissionDetail() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubmission();
  }, [submissionId]);

  const fetchSubmission = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          form_templates(name, slug),
          team_members(name, email)
        `)
        .eq('id', submissionId)
        .single();

      if (error) throw error;
      setSubmission(data);
    } catch (error: any) {
      console.error('Error fetching submission:', error);
      toast.error('Failed to load submission details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Submission not found</p>
              <Button variant="outline" onClick={() => navigate(-1)}>
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Submission Details</h1>
          <p className="text-muted-foreground">
            {submission.form_templates?.name || 'Unknown Form'} • {format(new Date(submission.submitted_at), 'PPP')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Submission Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Team Member</span>
              <p className="font-medium">{submission.team_members?.name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{submission.team_members?.email}</p>
            </div>
            
            <div>
              <span className="text-sm text-muted-foreground">Work Date</span>
              <p className="font-medium">{format(new Date(submission.work_date), 'PPP')}</p>
            </div>
            
            <div>
              <span className="text-sm text-muted-foreground">Submitted</span>
              <p className="font-medium">{format(new Date(submission.submitted_at), 'PPpp')}</p>
            </div>
            
            <div>
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex gap-2 mt-1">
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {submission.payload_json && typeof submission.payload_json === 'object' ? (
                Object.entries(submission.payload_json).map(([key, value]) => {
                  // Handle repeater data (household information)
                  if (key.includes('household') || key.includes('repeater') || Array.isArray(value)) {
                    return (
                      <div key={key} className="border rounded-md p-3">
                        <span className="text-sm font-medium text-primary">
                          {key === 'repeaterData' ? 'Household Information' : 
                           key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim()}
                        </span>
                        {Array.isArray(value) ? (
                          <div className="mt-2 space-y-2">
                            {value.map((item: any, index: number) => (
                              <div key={index} className="bg-muted/50 rounded p-2">
                                <div className="text-xs text-muted-foreground mb-1">Household {index + 1}</div>
                                {typeof item === 'object' ? (
                                  <div className="grid gap-1">
                                    {Object.entries(item).map(([itemKey, itemValue]) => (
                                      <div key={itemKey} className="flex justify-between text-sm">
                                        <span className="text-muted-foreground capitalize">
                                          {itemKey.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim()}:
                                        </span>
                                        <span className="font-medium">{String(itemValue)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-sm">{String(item)}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : typeof value === 'object' ? (
                          <div className="mt-2 grid gap-1">
                            {Object.entries(value).map(([subKey, subValue]) => (
                              <div key={subKey} className="flex justify-between text-sm">
                                <span className="text-muted-foreground capitalize">
                                  {subKey.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim()}:
                                </span>
                                <span className="font-medium">{String(subValue)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-sm">{String(value)}</p>
                        )}
                      </div>
                    );
                  }
                  
                  // Handle regular form fields
                  return (
                    <div key={key} className="border-b pb-2 last:border-b-0">
                      <span className="text-sm text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim()}
                      </span>
                      <p className="font-medium">
                        {typeof value === 'object' 
                          ? JSON.stringify(value, null, 2) 
                          : String(value)}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-muted-foreground">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}