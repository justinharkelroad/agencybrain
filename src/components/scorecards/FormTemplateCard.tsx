import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Link2, Trash2, ExternalLink, Copy, Eye, EyeOff, Edit3, MoreVertical, Clock, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useScorecardForms } from "@/hooks/useScorecardForms";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FormTemplate {
  id: string;
  name: string;
  slug: string;
  role: string;
  schema_json: any;
  settings_json: any;
  is_active: boolean;
  status?: string;
  created_at: string;
  updated_at: string;
}

interface FormTemplateCardProps {
  form: FormTemplate;
  onDelete?: (formId: string) => Promise<void>;
  onToggleActive?: (formId: string, isActive: boolean) => Promise<boolean>;
  isStaffMode?: boolean;
}

export default function FormTemplateCard({ form, onDelete, onToggleActive, isStaffMode = false }: FormTemplateCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    createFormLink, 
    getFormLink, 
    toggleFormLink, 
    deleteForm: hookDeleteForm, 
    generatePublicUrl 
  } = useScorecardForms();
  
  const [linkEnabled, setLinkEnabled] = useState(false);
  const [formLink, setFormLink] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Determine base path for navigation based on staff mode
  const getEditPath = () => {
    if (isStaffMode || location.pathname.startsWith('/staff')) {
      return `/staff/metrics/edit/${form.id}`;
    }
    return `/metrics/edit/${form.id}`;
  };

  const handleGenerateLink = async () => {
    setLoading(true);
    try {
      let link = await getFormLink(form.id);
      
      if (!link) {
        link = await createFormLink(form.id);
      }
      
      if (link) {
        const publicUrl = await generatePublicUrl(form, link.token);
        setFormLink(publicUrl || "");
        setLinkEnabled(link.enabled);
        
        if (publicUrl) {
          await navigator.clipboard.writeText(publicUrl);
          toast.success("Form link copied to clipboard!");
        }
      }
    } catch (error) {
      console.error('Error with form link:', error);
      toast.error("Failed to generate form link");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLink = async () => {
    const newState = !linkEnabled;
    const success = await toggleFormLink(form.id, newState);
    if (success) {
      setLinkEnabled(newState);
    }
  };

  const handleDeleteForm = async () => {
    if (onDelete) {
      await onDelete(form.id);
    } else {
      await hookDeleteForm(form.id);
    }
  };

  const handleCopyLink = async () => {
    if (formLink) {
      await navigator.clipboard.writeText(formLink);
      toast.success("Link copied to clipboard!");
    }
  };

  const kpiCount = form.schema_json?.kpis?.length || 0;
  const customFieldCount = form.schema_json?.customFields?.length || 0;
  const hasRepeaterSections = form.schema_json?.repeaterSections && (
    form.schema_json.repeaterSections.quotedDetails?.enabled || 
    form.schema_json.repeaterSections.soldDetails?.enabled
  );

  const handleToggleActive = async () => {
    if (onToggleActive) {
      await onToggleActive(form.id, !form.is_active);
    }
  };

  return (
    <Card className={cn(!form.is_active && "opacity-60 border-dashed")}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <CardTitle className="text-lg">{form.name}</CardTitle>
              {!form.is_active && (
                <Badge variant="destructive">Inactive</Badge>
              )}
              <Badge variant={form.role === 'Sales' ? 'default' : 'secondary'}>
                {form.role}
              </Badge>
              <Badge variant={form.status === 'published' ? 'default' : 'outline'}>
                {form.status || 'draft'}
              </Badge>
            </div>
            <CardDescription className="text-sm">
              {kpiCount} KPIs • {customFieldCount} custom fields
              {hasRepeaterSections && " • Dynamic sections enabled"}
            </CardDescription>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              <DropdownMenuItem onClick={() => navigate(getEditPath())} className="text-foreground">
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Form
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleGenerateLink} disabled={loading} className="text-foreground">
                <Link2 className="h-4 w-4 mr-2" />
                {loading ? "Generating..." : "Generate Link"}
              </DropdownMenuItem>
              {formLink && (
                <>
                  <DropdownMenuItem onClick={handleCopyLink} className="text-foreground">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(formLink, '_blank')} className="text-foreground">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Form
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem className="text-foreground">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Analytics
              </DropdownMenuItem>
              <DropdownMenuItem className="text-foreground">
                <Clock className="h-4 w-4 mr-2" />
                Set Expiration
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleToggleActive} className="text-foreground">
                {form.is_active ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Deactivate Form
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Activate Form
                  </>
                )}
              </DropdownMenuItem>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Form
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Form</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{form.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteForm}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground">
          Created {new Date(form.created_at).toLocaleDateString()}
        </div>
        
        {formLink && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Public Link</span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={linkEnabled}
                  onCheckedChange={handleToggleLink}
                />
                <span className="text-xs text-muted-foreground">
                  {linkEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>
            <div className="bg-muted p-2 rounded text-xs font-mono break-all">
              {formLink}
            </div>
          </div>
        )}
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(getEditPath())}
            className="flex-1"
          >
            <Edit3 className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGenerateLink}
            disabled={loading}
          >
            <Link2 className="h-4 w-4 mr-1" />
            {loading ? "..." : "Link"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
