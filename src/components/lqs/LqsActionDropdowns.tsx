import { useState } from 'react';
import { Plus, Upload, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LeadUploadModal } from './LeadUploadModal';
import { SalesUploadModal } from './SalesUploadModal';
import { LqsLeadSource } from '@/hooks/useLqsData';
import type { SalesUploadResult } from '@/types/lqs';

interface LqsActionDropdownsProps {
  onAddLead: () => void;
  onAddQuote: () => void;
  onUploadQuotes: () => void;
  agencyId: string;
  userId?: string | null;
  displayName?: string;
  leadSources: LqsLeadSource[];
  onUploadComplete?: () => void;
  onSalesUploadResults?: (result: SalesUploadResult) => void;
}

export function LqsActionDropdowns({ 
  onAddLead, 
  onAddQuote, 
  onUploadQuotes,
  agencyId,
  userId = null,
  displayName = 'User',
  leadSources,
  onUploadComplete,
  onSalesUploadResults,
}: LqsActionDropdownsProps) {
  const [showLeadUpload, setShowLeadUpload] = useState(false);
  const [showSalesUpload, setShowSalesUpload] = useState(false);

  return (
    <>
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
            <DropdownMenuItem onClick={() => setShowLeadUpload(true)}>
              Upload Leads
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onUploadQuotes}>
              Upload Quotes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowSalesUpload(true)}>
              Upload Sales
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <LeadUploadModal
        open={showLeadUpload}
        onOpenChange={setShowLeadUpload}
        agencyId={agencyId}
        leadSources={leadSources}
        onUploadComplete={onUploadComplete}
      />

      <SalesUploadModal
        open={showSalesUpload}
        onOpenChange={setShowSalesUpload}
        agencyId={agencyId}
        userId={userId}
        displayName={displayName}
        onUploadComplete={onUploadComplete}
        onUploadResults={onSalesUploadResults}
      />
    </>
  );
}