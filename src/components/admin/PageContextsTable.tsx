import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileText, Layers, HelpCircle, Eye } from "lucide-react";
import { toast } from "sonner";

interface PageContext {
  id: string;
  page_route: string;
  page_title: string;
  content: {
    overview?: string;
    ui_elements?: any[];
    common_questions?: any[];
    not_about?: string[];
    related_pages?: any[];
  };
  related_faq_categories: string[];
  applies_to_portals: string[];
  applies_to_tiers: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function PageContextsTable() {
  const queryClient = useQueryClient();

  const { data: pageContexts = [], isLoading } = useQuery({
    queryKey: ['admin-page-contexts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_page_contexts')
        .select('*')
        .order('page_route', { ascending: true });
      
      if (error) throw error;
      return (data || []) as PageContext[];
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('chatbot_page_contexts')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-page-contexts'] });
      toast.success('Page context updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update');
    },
  });

  const getUiElementsCount = (context: PageContext) => {
    return context.content?.ui_elements?.length || 0;
  };

  const getQuestionsCount = (context: PageContext) => {
    return context.content?.common_questions?.length || 0;
  };

  const getPortalBadge = (portals: string[]) => {
    if (portals.includes('both') || (portals.includes('brain') && portals.includes('staff'))) {
      return <Badge variant="outline">Both</Badge>;
    }
    if (portals.includes('staff')) {
      return <Badge variant="secondary">Staff</Badge>;
    }
    return <Badge>Brain</Badge>;
  };

  const getTierBadge = (tiers: string[]) => {
    if (tiers.includes('all')) {
      return <Badge variant="outline">All Tiers</Badge>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {tiers.map(tier => (
          <Badge key={tier} variant="secondary" className="text-xs">
            {tier}
          </Badge>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        Loading page contexts...
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Route</TableHead>
            <TableHead className="w-[150px]">Title</TableHead>
            <TableHead className="w-[80px] text-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center justify-center gap-1 cursor-help">
                      <Layers className="h-4 w-4" />
                      UI
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>UI Elements defined</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableHead>
            <TableHead className="w-[80px] text-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center justify-center gap-1 cursor-help">
                      <HelpCircle className="h-4 w-4" />
                      Q&A
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Common Questions</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableHead>
            <TableHead className="w-[100px]">Portal</TableHead>
            <TableHead className="w-[120px]">Tiers</TableHead>
            <TableHead className="w-[80px]">Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageContexts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No page contexts found
              </TableCell>
            </TableRow>
          ) : (
            pageContexts.map(context => (
              <TableRow key={context.id}>
                <TableCell>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {context.page_route}
                  </code>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-medium cursor-help flex items-center gap-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          {context.page_title}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="text-xs">{context.content?.overview?.slice(0, 200)}...</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={getUiElementsCount(context) > 0 ? "default" : "outline"}>
                    {getUiElementsCount(context)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={getQuestionsCount(context) > 0 ? "secondary" : "outline"}>
                    {getQuestionsCount(context)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {getPortalBadge(context.applies_to_portals)}
                </TableCell>
                <TableCell>
                  {getTierBadge(context.applies_to_tiers)}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={context.is_active}
                    onCheckedChange={(checked) => 
                      toggleActiveMutation.mutate({ id: context.id, is_active: checked })
                    }
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
