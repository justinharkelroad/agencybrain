import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Link2, Settings, Trash2, ExternalLink, Copy, Eye, Edit3, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { useScorecardForms } from "@/hooks/useScorecardForms";
import { useNavigate } from "react-router-dom";

interface FormTemplate {
  id: string;
  name: string;
  slug: string;
  role: string;
  schema_json: any;
  settings_json: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormTemplateCardProps {
  form: FormTemplate;
}

export default function FormTemplateCard({ form }: FormTemplateCardProps) {
  const navigate = useNavigate();
  const { 
    createFormLink, 
    getFormLink, 
    toggleFormLink, 
    deleteForm, 
    generatePublicUrl 
  } = useScorecardForms();
  
  const [linkEnabled, setLinkEnabled] = useState(false);
  const [formLink, setFormLink] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleGenerateLink = async () => {
    setLoading(true);
    try {
      // Check if a link already exists
      let link = await getFormLink(form.id);
      
      if (!link) {
        // Create new link
        link = await createFormLink(form.id);
      }
      
      if (link) {
        const publicUrl = generatePublicUrl('', form.slug, link.token);
        setFormLink(publicUrl);
        setLinkEnabled(link.enabled);
        
        // Copy to clipboard
        await navigator.clipboard.writeText(publicUrl);
        toast.success("Form link copied to clipboard!");
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
    const success = await deleteForm(form.id);
    // Form list will refresh automatically due to the hook
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{form.name}</CardTitle>
              <Badge variant={form.role === 'Sales' ? 'default' : 'secondary'}>
                {form.role}
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
              <DropdownMenuItem onClick={() => navigate(`/scorecard-forms/edit/${form.id}`)} className="text-foreground">
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
            onClick={() => navigate(`/scorecard-forms/edit/${form.id}`)}
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