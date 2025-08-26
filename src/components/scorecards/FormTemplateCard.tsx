import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  MoreVertical, 
  Edit, 
  Link2, 
  Eye, 
  EyeOff, 
  Copy, 
  Trash2,
  Users,
  Calendar
} from "lucide-react";
import { toast } from "sonner";
import { useScorecardForms } from "@/hooks/useScorecardForms";

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
  agencySlug?: string;
}

export default function FormTemplateCard({ form, agencySlug = "demo" }: FormTemplateCardProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [formLink, setFormLink] = useState<string>("");
  const [linkEnabled, setLinkEnabled] = useState(true);
  const { getFormLink, createFormLink, toggleFormLink, deleteForm, generatePublicUrl } = useScorecardForms();

  const handleGenerateLink = async () => {
    let link = await getFormLink(form.id);
    
    if (!link) {
      link = await createFormLink(form.id);
    }
    
    if (link) {
      const publicUrl = generatePublicUrl(agencySlug, form.slug, link.token);
      setFormLink(publicUrl);
      setLinkEnabled(link.enabled);
      setLinkDialogOpen(true);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(formLink);
    toast.success("Link copied to clipboard!");
  };

  const handleToggleLink = async () => {
    const success = await toggleFormLink(form.id, !linkEnabled);
    if (success) {
      setLinkEnabled(!linkEnabled);
    }
  };

  const handleDeleteForm = async () => {
    if (confirm("Are you sure you want to delete this form? This action cannot be undone.")) {
      await deleteForm(form.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getKPICount = () => {
    return form.schema_json?.kpis?.length || 0;
  };

  return (
    <Card className="relative group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              {form.name}
              <Badge variant={form.role === 'sales' ? 'default' : 'secondary'}>
                {form.role}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              {getKPICount()} KPI fields • Created {formatDate(form.created_at)}
            </CardDescription>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleGenerateLink}>
                <Link2 className="h-4 w-4 mr-2" />
                Get Link
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Edit className="h-4 w-4 mr-2" />
                Edit Form
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeleteForm} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>0 submissions</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Due by {form.settings_json?.dueBy || 'same-day'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGenerateLink}
            className="flex-1"
          >
            <Link2 className="h-4 w-4 mr-2" />
            Get Link
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Eye className="h-4 w-4 mr-2" />
            View Data
          </Button>
        </div>
      </CardContent>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Form Submission Link</DialogTitle>
            <DialogDescription>
              Share this link with your team members to collect their daily KPI data.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="form-link">Public Form URL</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="form-link"
                  value={formLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Link Status</p>
                <p className="text-sm text-muted-foreground">
                  {linkEnabled ? "Active - accepting submissions" : "Disabled - not accepting submissions"}
                </p>
              </div>
              <Button 
                variant={linkEnabled ? "destructive" : "default"}
                size="sm"
                onClick={handleToggleLink}
              >
                {linkEnabled ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Disable
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Enable
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}