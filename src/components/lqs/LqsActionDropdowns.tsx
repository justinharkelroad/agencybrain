import { Plus, Upload, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface LqsActionDropdownsProps {
  onAddLead: () => void;
  onAddQuote: () => void;
  onUploadQuotes: () => void;
}

export function LqsActionDropdowns({ onAddLead, onAddQuote, onUploadQuotes }: LqsActionDropdownsProps) {
  const handleUploadLeads = () => {
    toast.info('Upload Leads coming soon!', {
      description: 'This feature is under development.',
    });
  };

  const handleUploadSales = () => {
    toast.info('Upload Sales coming soon!', {
      description: 'This feature is under development.',
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Add Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-background z-50">
          <DropdownMenuItem onClick={onAddLead}>
            Add Lead
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddQuote}>
            Add Quote
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Upload Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" />
            Upload
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-background z-50">
          <DropdownMenuItem onClick={handleUploadLeads}>
            Upload Leads
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onUploadQuotes}>
            Upload Quotes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleUploadSales}>
            Upload Sales
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
