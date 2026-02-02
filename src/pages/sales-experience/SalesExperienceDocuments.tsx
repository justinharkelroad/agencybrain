import { Link, useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useSalesExperienceAccess } from '@/hooks/useSalesExperienceAccess';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  ArrowLeft,
  FileText,
  Download,
  ExternalLink,
  Video,
  File,
  Link as LinkIcon,
} from 'lucide-react';

interface Resource {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  file_type: 'pdf' | 'doc' | 'video' | 'link';
  storage_path: string | null;
  external_url: string | null;
  is_staff_visible: boolean;
  sort_order: number;
}

interface Module {
  id: string;
  week_number: number;
  title: string;
}

const fileTypeIcons = {
  pdf: FileText,
  doc: File,
  video: Video,
  link: LinkIcon,
};

const fileTypeLabels = {
  pdf: 'PDF Document',
  doc: 'Document',
  video: 'Video',
  link: 'External Link',
};

export default function SalesExperienceDocuments() {
  const { week } = useParams<{ week: string }>();
  const weekNumber = parseInt(week || '1', 10);
  const { hasAccess, currentWeek, assignment, isLoading: accessLoading } = useSalesExperienceAccess();

  // Fetch module for this week
  const { data: module, isLoading: moduleLoading } = useQuery({
    queryKey: ['sales-experience-module', weekNumber],
    enabled: hasAccess && !isNaN(weekNumber),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_modules')
        .select('id, week_number, title')
        .eq('week_number', weekNumber)
        .single();

      if (error) throw error;
      return data as Module;
    },
  });

  // Fetch resources for this week
  const { data: resources, isLoading: resourcesLoading } = useQuery({
    queryKey: ['sales-experience-resources', weekNumber, module?.id],
    enabled: hasAccess && !!module?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_resources')
        .select('*')
        .eq('module_id', module!.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Resource[];
    },
  });

  const isWeekUnlocked = currentWeek >= weekNumber;

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!isWeekUnlocked) {
    return <Navigate to="/sales-experience" replace />;
  }

  const isLoading = moduleLoading || resourcesLoading;

  const handleDownload = async (resource: Resource) => {
    if (resource.external_url) {
      window.open(resource.external_url, '_blank');
      return;
    }

    if (resource.storage_path) {
      // Get signed URL from Supabase storage
      const { data, error } = await supabase.storage
        .from('sales-experience')
        .createSignedUrl(resource.storage_path, 3600); // 1 hour expiry

      if (error) {
        console.error('Error getting download URL:', error);
        return;
      }

      window.open(data.signedUrl, '_blank');
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Back Link */}
      <Link
        to={`/sales-experience/week/${weekNumber}`}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Week {weekNumber}
      </Link>

      {/* Header */}
      {isLoading ? (
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
      ) : (
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Week {weekNumber} Documents
          </h1>
          <p className="text-muted-foreground">
            {module?.title} - Resources and materials
          </p>
        </div>
      )}

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Available Resources
          </CardTitle>
          <CardDescription>
            Download documents, templates, and worksheets for this week
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : resources && resources.length > 0 ? (
            <div className="space-y-3">
              {resources.map((resource) => {
                const Icon = fileTypeIcons[resource.file_type];
                const isExternal = !!resource.external_url;

                return (
                  <Card key={resource.id} className="bg-muted/30">
                    <CardContent className="flex items-center gap-4 p-4">
                      {/* Icon */}
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{resource.title}</h4>
                        {resource.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {resource.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {fileTypeLabels[resource.file_type]}
                          </Badge>
                          {resource.is_staff_visible && (
                            <Badge variant="secondary" className="text-xs">
                              Shared with Staff
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Action */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => handleDownload(resource)}
                      >
                        {isExternal ? (
                          <>
                            <ExternalLink className="h-4 w-4" />
                            Open
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4" />
                            Download
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No documents available for this week yet.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Check back after your coaching call.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Link to={`/sales-experience/week/${weekNumber}`}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Lessons
          </Button>
        </Link>
        <Link to={`/sales-experience/week/${weekNumber}/transcript`}>
          <Button variant="outline" className="gap-2">
            View Transcript
            <ExternalLink className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
